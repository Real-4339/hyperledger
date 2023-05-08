import { Gateway, Wallets } from "fabric-network";
import FabricCAServices from "fabric-ca-client";
import path from "node:path";
import { createRequire } from "module";
import { futimesSync } from "node:fs";
const require = createRequire(import.meta.url);
const { buildCAClient, enrollAdmin, registerAndEnrollUser } = require("../../javascript/CAUtil.js");
const { buildCCPOrg1, buildCCPOrg2, buildCCPOrg3, buildWallet } = require("../../javascript/AppUtil.js");

const __dirname = path.resolve();
const walletPath = path.join(__dirname, "wallet");
const channel = "mychannel";

type Org = {
	msp: string,
	userId: string,
	cpp: any,
	caClient: any,
	caHostName: string,
	department: string,
	buildCCP: () => void,
};

const org1: Org = {
	msp: "Org1MSP",
	userId: "BusyFly",
	caHostName: "ca.org1.example.com",
	department: "org1.department1",
	cpp: {},
	caClient: {},
	buildCCP: buildCCPOrg1,
};

const org2: Org = {
	msp: "Org2MSP",
	userId: "Office",
	caHostName: "ca.org2.example.com",
	department: "org2.department1",
	cpp: {},
	caClient: {},
	buildCCP: buildCCPOrg2,
};

const org3: Org = {
	msp: "Org3MSP",
	userId: "EconFly",
	caHostName: "ca.org3.example.com",
	department: "org3.department1",
	cpp: {},
	caClient: {},
	buildCCP: buildCCPOrg3,
};


function prettyJSONString(inputString: string) {
	return JSON.stringify(JSON.parse(inputString), null, 2);
}

async function setupOrg(org: Org, wallet: any) {
	const ccp = org.buildCCP();
	const caClient = buildCAClient(FabricCAServices, ccp, org.caHostName);
	await enrollAdmin(caClient, wallet, org.msp);
	await registerAndEnrollUser(caClient, wallet, org.msp, org.userId, org.department);

	org.cpp = ccp;
	org.caClient = caClient;
}

console.warn("Setting up Orgs");
const wallet1 = await buildWallet(Wallets, walletPath + "1");
await setupOrg(org1, wallet1);
const wallet2 = await buildWallet(Wallets, walletPath + "2");
await setupOrg(org2, wallet2);


async function createFlight_test() {
	const gateway = new Gateway();
	const org = org1;
	await gateway.connect(org.cpp, {
		wallet: wallet1,
		identity: org.userId,
		discovery: {
			enabled: true,
			asLocalhost: true,
		},
	});

	const network = await gateway.getNetwork(channel);
	const contract = network.getContract("basic");
	const from = "SFO";
	const to = "JFK";
	const date = "2021-07-01";
	const seats = 100;

	console.warn("Creating flight");
	const flight = await contract.submitTransaction("createFlight", from, to, date, String(seats));
	console.log(flight.toString());
	const flightData = await contract.evaluateTransaction("getAllFlights");
	console.dir(JSON.parse(flightData.toString()), { depth: null });

	console.warn("\n\n\nCreating flights with Office - should fail");
	await gateway.connect(org2.cpp, {
		wallet: wallet2,
		identity: org2.userId,
		discovery: {
			enabled: true,
			asLocalhost: true,
		},
	});

	const flightOffice = await contract.submitTransaction("createFlight", from, to, date, String(seats))
		.catch(err => console.error(err.responses.map(res => res.response.message)));
	console.log(flightOffice?.toString());

	console.warn("Get non existing flight - should fail");
	const flight2 = await contract.evaluateTransaction("getFlight", "EC110").
		catch(err => console.error(err.responses?.map(res => res.response.message)));

}

async function bookFlight_test() {
	const gateway = new Gateway();
	await gateway.connect(org2.cpp, {
		wallet: wallet2,
		identity: org2.userId,
		discovery: {
			enabled: true,
			asLocalhost: true,
		},
	});

	const network = await gateway.getNetwork(channel);
	const contract = network.getContract("basic");

	const reserved = await contract.submitTransaction(
		"reserveSeats",
		"EC0",
		"2",
		JSON.stringify(["John", "Doe"]),
		JSON.stringify(["JaneEMAIL", "DoeEMAIL"]),
	);
	console.log(reserved.toString());

	console.warn("\n\n\nReserving seats too many seats with Office- should fail");
	const reserved_fail = await contract.submitTransaction(
		"reserveSeats",
		"EC0",
		"200",
		JSON.stringify(["John", "Doe"]),
		JSON.stringify(["JaneEMAIL", "DoeEMAIL"]),
	).catch(err => console.error(err.responses.map(res => res.response.message)));
	console.log(reserved.toString());

	console.warn("\n\n\nReserving seats with BusyFly - should fail");
	const gateway_busy = new Gateway();
	await gateway_busy.connect(org1.cpp, {
		wallet: wallet1,
		identity: org1.userId,
		discovery: {
			enabled: true,
			asLocalhost: true,
		} });

	const network_busy = await gateway_busy.getNetwork(channel);
	const contract_busy = network_busy.getContract("basic");
	const reserved_busy = await contract_busy.submitTransaction(
		"reserveSeats",
		"EC0",
		"2",
		JSON.stringify(["John", "Doe"]),
		JSON.stringify(["JaneEMAIL", "DoeEMAIL"]),
	).catch(err => console.error(err.responses.map(res => res.response.message)));
	const flightData = await contract.evaluateTransaction("getAllFlights");
	JSON.parse(flightData.toString()).forEach((flight: any) => {
		console.dir(JSON.stringify(flight));
	});

	console.warn("\n\n\nGet reservation - R0");
	const reservations = await contract.submitTransaction("getReservation", "R0");
	console.log(prettyJSONString(reservations.toString()));

}


await createFlight_test();
await bookFlight_test();
