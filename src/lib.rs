#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String, symbol_short};

const DAY: u32 = 17280;

#[contracttype]
pub enum DataKey {
    Admin,
    ProposalCount,
    Proposal(u64),
    Voted(u64, Address),
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Proposal {
    pub id: u64,
    pub creator: Address,
    pub title: String,
    pub yes_votes: u32,
    pub no_votes: u32,
    pub active: bool,
}

#[contract]
pub struct Voting;

#[contractimpl]
impl Voting {
    pub fn initialize(env: Env, admin: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::ProposalCount, &0_u64);
        env.storage().instance().extend_ttl(6 * DAY, 7 * DAY);
    }

    pub fn create_proposal(env: Env, creator: Address, title: String) -> u64 {
        creator.require_auth();
        let id: u64 = env.storage().instance().get(&DataKey::ProposalCount).unwrap_or(0) + 1;
        let proposal = Proposal { id, creator, title, yes_votes: 0, no_votes: 0, active: true };
        env.storage().persistent().set(&DataKey::Proposal(id), &proposal);
        env.storage().instance().set(&DataKey::ProposalCount, &id);
        env.storage().instance().extend_ttl(6 * DAY, 7 * DAY);
        id
    }

    pub fn vote(env: Env, voter: Address, proposal_id: u64, approve: bool) {
        voter.require_auth();
        if env.storage().persistent().has(&DataKey::Voted(proposal_id, voter.clone())) {
            panic!("Already voted");
        }
        let mut p: Proposal = env.storage().persistent().get(&DataKey::Proposal(proposal_id)).unwrap();
        if !p.active { panic!("Proposal is closed"); }
        if approve { p.yes_votes += 1; } else { p.no_votes += 1; }
        env.storage().persistent().set(&DataKey::Proposal(proposal_id), &p);
        env.storage().persistent().set(&DataKey::Voted(proposal_id, voter), &true);
        env.events().publish((symbol_short!("vote"), proposal_id), approve);
    }

    pub fn get_proposal(env: Env, id: u64) -> Proposal {
        env.storage().persistent().get(&DataKey::Proposal(id)).unwrap()
    }

    pub fn close_proposal(env: Env, proposal_id: u64) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        let mut p: Proposal = env.storage().persistent().get(&DataKey::Proposal(proposal_id)).unwrap();
        p.active = false;
        env.storage().persistent().set(&DataKey::Proposal(proposal_id), &p);
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env, String};

    #[test]
    fn test_vote_flow() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(Voting, ());
        let client = VotingClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        client.initialize(&admin);
        let creator = Address::generate(&env);
        let id = client.create_proposal(&creator, &String::from_str(&env, "Add a gym"));
        let voter1 = Address::generate(&env);
        let voter2 = Address::generate(&env);
        client.vote(&voter1, &id, &true);
        client.vote(&voter2, &id, &false);
        let p = client.get_proposal(&id);
        assert_eq!(p.yes_votes, 1);
        assert_eq!(p.no_votes, 1);
    }
}