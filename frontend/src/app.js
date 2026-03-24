import * as StellarSdk from "@stellar/stellar-sdk";
import {
  isConnected,
  getPublicKey,
  setAllowed,
  signTransaction,
} from "@stellar/freighter-api";

const CONTRACT_ID = "CCTXBRPPVXD4NUOJDWBUXDLPFK2CC6TOST632JM76DQOPZ2EX6XQAOR6";
const RPC_URL = "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
const EXPLORER_URL = "https://stellar.expert/explorer/testnet";

const connectBtn = document.getElementById("connectBtn");
const walletDisplay = document.getElementById("walletDisplay");
const resultArea = document.getElementById("resultArea");

function truncate(addr) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function showResult(msg, type = "loading") {
  resultArea.innerHTML = `<div class="result-msg ${type}">${msg}</div>`;
}

function setButtonLoading(btn, loading) {
  btn.disabled = loading;
  if (loading) {
    btn.dataset.originalText = btn.textContent;
    btn.textContent = "Processing...";
  } else {
    btn.textContent = btn.dataset.originalText || btn.textContent;
  }
}

async function connectWallet() {
  if (!(await isConnected())) {
    alert(
      "Please install the Freighter wallet extension.\nhttps://freighter.app",
    );
    return null;
  }
  await setAllowed();
  const address = await getPublicKey();
  walletDisplay.textContent = truncate(address);
  return address;
}

connectBtn.addEventListener("click", async () => {
  try {
    const address = await connectWallet();
    if (address) {
      connectBtn.textContent = truncate(address);
      connectBtn.classList.add("connected");
    }
  } catch (err) {
    showResult("Wallet connection failed: " + err.message, "error");
  }
});

async function callContract(funcName, ...args) {
  const address = await connectWallet();
  if (!address) return null;

  const server = new StellarSdk.rpc.Server(RPC_URL);
  const account = await server.getAccount(address);
  const contract = new StellarSdk.Contract(CONTRACT_ID);

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(funcName, ...args))
    .setTimeout(30)
    .build();

  const prepared = await server.prepareTransaction(tx);

  const signResult = await signTransaction(prepared.toXDR(), {
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  const signedXdr =
    typeof signResult === "string" ? signResult : signResult.signedTxXdr;

  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "sendTransaction",
      params: { transaction: signedXdr },
    }),
  });
  const json = await res.json();
  const hash = json.result?.hash;
  const status = json.result?.status;

  if (!hash) throw new Error(JSON.stringify(json.error || json));

  if (status === "PENDING") {
    let txStatus = "NOT_FOUND";
    while (txStatus === "NOT_FOUND") {
      await new Promise((r) => setTimeout(r, 1500));
      const pollRes = await fetch(RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getTransaction",
          params: { hash: hash },
        }),
      });
      const pollJson = await pollRes.json();
      txStatus = pollJson.result?.status;
    }
    return { status: txStatus, hash };
  }

  return { status, hash };
}

async function simulateContract(funcName, ...args) {
  const address = await connectWallet();
  if (!address) return null;

  const server = new StellarSdk.rpc.Server(RPC_URL);
  const account = await server.getAccount(address);
  const contract = new StellarSdk.Contract(CONTRACT_ID);

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(funcName, ...args))
    .setTimeout(30)
    .build();

  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "simulateTransaction",
      params: { transaction: tx.toXDR() },
    }),
  });
  const json = await res.json();
  if (json.error) throw new Error(JSON.stringify(json.error));

  const retval = json.result?.results?.[0]?.xdr;
  if (!retval) throw new Error("No return value from simulation");
  return StellarSdk.scValToNative(
    StellarSdk.xdr.ScVal.fromXDR(retval, "base64"),
  );
}

document.getElementById("createBtn").addEventListener("click", async () => {
  const titleInput = document.getElementById("proposalTitle");
  const title = titleInput.value.trim();
  if (!title) {
    showResult("Enter a proposal title.", "error");
    return;
  }

  const btn = document.getElementById("createBtn");
  setButtonLoading(btn, true);
  showResult("Creating proposal...", "loading");

  try {
    const address = await connectWallet();
    if (!address) return;

    const result = await callContract(
      "create_proposal",
      new StellarSdk.Address(address).toScVal(),
      StellarSdk.nativeToScVal(title, { type: "string" }),
    );

    if (result && result.status === "SUCCESS") {
      showResult(
        `Proposal created! TX: <a href="${EXPLORER_URL}/tx/${result.hash}" target="_blank">${result.hash.slice(0, 16)}...</a>`,
        "success",
      );
      titleInput.value = "";
    } else {
      showResult(
        "Transaction failed: " + (result?.status || "unknown"),
        "error",
      );
    }
  } catch (err) {
    showResult("Error: " + err.message, "error");
  } finally {
    setButtonLoading(btn, false);
  }
});

async function handleLoadProposal() {
  const idInput = document.getElementById("proposalId");
  const id = parseInt(idInput.value, 10);
  if (!id || id < 1) {
    showResult("Enter a valid proposal ID.", "error");
    return;
  }

  showResult("Loading proposal...", "loading");

  try {
    const proposal = await simulateContract(
      "get_proposal",
      StellarSdk.nativeToScVal(id, { type: "u64" }),
    );

    displayProposal(proposal);
    showResult("Proposal loaded.", "success");
  } catch (err) {
    document.getElementById("proposalInfo").classList.remove("visible");
    showResult("Proposal not found or error: " + err.message, "error");
  }
}

document
  .getElementById("loadBtn")
  .addEventListener("click", handleLoadProposal);

function displayProposal(p) {
  const info = document.getElementById("proposalInfo");
  info.classList.add("visible");

  document.getElementById("pTitle").textContent =
    p.title || `Proposal #${p.id}`;

  const status = document.getElementById("pStatus");
  status.textContent = p.active ? "Active" : "Closed";
  status.className = "badge-active " + (p.active ? "open" : "closed");

  const total = p.yes_votes + p.no_votes;
  const yesPct = total > 0 ? (p.yes_votes / total) * 100 : 0;
  const noPct = total > 0 ? (p.no_votes / total) * 100 : 0;

  document.getElementById("yesBar").style.width = yesPct + "%";
  document.getElementById("noBar").style.width = noPct + "%";
  document.getElementById("yesCount").textContent = `Yes: ${p.yes_votes}`;
  document.getElementById("noCount").textContent = `No: ${p.no_votes}`;

  document.getElementById("voteYesBtn").disabled = !p.active;
  document.getElementById("voteNoBtn").disabled = !p.active;
}

async function handleVote(approve) {
  const idInput = document.getElementById("proposalId");
  const id = parseInt(idInput.value, 10);
  if (!id || id < 1) {
    showResult("Enter a valid proposal ID.", "error");
    return;
  }

  const btn = approve
    ? document.getElementById("voteYesBtn")
    : document.getElementById("voteNoBtn");
  setButtonLoading(btn, true);
  showResult(approve ? "Voting Yes..." : "Voting No...", "loading");

  try {
    const address = await connectWallet();
    if (!address) return;

    const result = await callContract(
      "vote",
      new StellarSdk.Address(address).toScVal(),
      StellarSdk.nativeToScVal(id, { type: "u64" }),
      StellarSdk.nativeToScVal(approve, { type: "bool" }),
    );

    if (result && result.status === "SUCCESS") {
      showResult(
        `Vote recorded! TX: <a href="${EXPLORER_URL}/tx/${result.hash}" target="_blank">${result.hash.slice(0, 16)}...</a>`,
        "success",
      );
      await handleLoadProposal();
    } else {
      showResult("Vote failed: " + (result?.status || "unknown"), "error");
    }
  } catch (err) {
    showResult("Error: " + err.message, "error");
  } finally {
    setButtonLoading(btn, false);
  }
}

document
  .getElementById("voteYesBtn")
  .addEventListener("click", () => handleVote(true));
document
  .getElementById("voteNoBtn")
  .addEventListener("click", () => handleVote(false));
