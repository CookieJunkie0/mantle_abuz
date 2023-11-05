require('dotenv').config({path: __dirname + '/.env'});
const ethers = require('ethers');
const fs = require('fs');
const { ATESTATOR_ABI } = require('./abis');

const MANTLE_RPC = process.env.MANTLE_RPC;
const MANTLE_PROVIDER = new ethers.providers.JsonRpcProvider(MANTLE_RPC);

const WALLETS = fs.readFileSync(__dirname + '/wallets.txt', 'utf8').split('\n');

function mintAtestat(account) {
    const signer = account.connect(MANTLE_PROVIDER);
    const contract = new ethers.Contract("0x7C78b18F496d3D37c44De09da4a5a76Eb34B7e74", ATESTATOR_ABI, signer);

    
}