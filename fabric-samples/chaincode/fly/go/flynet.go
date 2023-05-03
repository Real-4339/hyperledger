package main

import (
	"encoding/json"
	"strconv"
	"errors"
	"fmt"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// FlyNetChaincode implements the chaincode interface for FlyNet network
type FlyNetChaincode struct {
	contractapi.Contract
}

// FlyNetChaincodeResult structure used for handling result of query
type FlyNetChaincodeResult struct {
	Key		string `json:"Key"`
	Record *FlyNetChaincode
}

// Flight represents a flight details of what makes up a flight
type Flight struct {
	FlyFrom				string `json:"flyFrom"`
	FlyTo				string `json:"flyTo"`
	dateTime			string `json:"dateTime"`
	availablePlaces		int    `json:"availablePlaces"`
	BookingStatuses		map[string]string `json:"bookingStatus"`
}

// Reservation represents a reservation of a flight
type Reservation struct {
	ReservationNr		string `json:"reservationNr"`
	CustomerNames		[]string `json:"customerNames"`
	customerEmail		string `json:"customerEmail"`
	FlightNr			string `json:"flightNr"`
	NrOfSeats			int    `json:"nrOfSeats"`
	Status 				string `json:"status"`
}

// Generates flightNr
func generateFlightNr(Org number) string {
	if Org == "Org1MSP" {
		return "EC" + strconv.Itoa(rand.Intn(1000))
	}
	if Org == "Org3MSP" {
		return "BS" + strconv.Itoa(rand.Intn(1000))
	}
	return nil
}

// CreateFlight creates a new flight on the ledger
func (t *FlyNetChaincode) CreateFlight(ctx contractapi.TransactionContextInterface, flyFrom string, flyTo string, dateTime string, seats int) (string, error) {
	callerOrg, err := ctx.GetClientIdentity().GetMSPID()
	
	if err != nil {
		return err, fmt.Errorf("Failed getting caller's org: %v", err)
	}

	if callerOrg != "Org1MSP" || callerOrg != "Org3MSP" {
		return err, fmt.Errorf("The caller is not authorized to invoke the CreateFlight function")
	}

	flightNr, err := generateFlightNr(callerOrg)

	if err == nil {
		return err, fmt.Errorf("Failed generating flightNr: %v", err)
	}
	
	flight := Flight{
		FlyFrom:			flyFrom,
		FlyTo:				flyTo,
		dateTime:			dateTime,
		availablePlaces:	seats,
	}

	flightAsBytes, err := json.Marshal(flight)
	if err != nil {
		return err, fmt.Errorf("Failed converting flight to bytes: %v", err)
	}

	err = ctx.GetStub().PutState(flightNr, flightAsBytes)
	if err != nil {
		return err, fmt.Errorf("Failed to put flight on ledger: %v", err)
	}
	return "Congrats, flight was created successfully", nil
}