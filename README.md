# Stellar Voting dApp

## Vấn Đề

Bỏ phiếu truyền thống thiếu minh bạch và dễ bị thao túng — kết quả không thể xác minh được.

## Giải Pháp

Một dApp bỏ phiếu phi tập trung trên Soroban, cho phép bất kỳ ai tạo đề xuất và bỏ phiếu đồng ý/không đồng ý, với kết quả được lưu trữ bất biến trên blockchain.

## Tại Sao Stellar

Phí thấp và tốc độ xác nhận nhanh của Soroban giúp việc bỏ phiếu on-chain trở nên thực tế và hiệu quả.

## Người Dùng Mục Tiêu

Cộng đồng, tổ chức sinh viên, hoặc DAO cần hệ thống quản trị đơn giản và minh bạch trên blockchain.

## Demo Trực Tiếp

- **Mạng**: Stellar Testnet
- **Contract ID**: `CCTXBRPPVXD4NUOJDWBUXDLPFK2CC6TOST632JM76DQOPZ2EX6XQAOR6`
- **Giao dịch**: https://stellar.expert/explorer/testnet/contract/CCTXBRPPVXD4NUOJDWBUXDLPFK2CC6TOST632JM76DQOPZ2EX6XQAOR6

## Cách Chạy

1. Clone: `git clone https://github.com/martindoillon/Stellar-voting-app`
2. Build: `stellar contract build`
3. Test: `cargo test`
4. Deploy: `stellar contract deploy --wasm target/wasm32v1-none/release/my_project.wasm --source-account student --network testnet`
5. Frontend: `cd frontend && npm install && npm run dev`

## Tech Stack

- Smart Contract: Rust / Soroban SDK v22
- Frontend: HTML / JavaScript / @stellar/stellar-sdk / Vite
- Wallet: Freighter
- Mạng: Stellar Testnet

## Nhóm

- Martin Doillon | masatav2@gmail.com | Greenwich Da Nang 2026
