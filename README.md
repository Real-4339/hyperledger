# hyperledger

<!-- organizations/fabric-ca/econfly  
fabric-ca-server start -b admin:adminpw --cfg.affiliations.allowremove --cfg.identities.allowremove -->

## How to run:

To start network:
```bash
./network.sh up
```

To deployt chaincode:
```bash
./network.sh deployCC -ccn basic -ccp ../chaincode/fly/go/ -ccl go
```