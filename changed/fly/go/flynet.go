package main

import (
	"encoding/json"
	"strconv"
	"errors"
	"fmt"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

/* TODO: For Misha
reserveSeats() - bookSeats()
Sedadlá sú objednané iba keď je požadované množstvo sedadiel stále dostupné na danom lete,
myslim si tak ze pri rezervacii odpocitam pocet sedadiel, a potom nemusim overovat ci je dostupne na bookovanie,
lebo nemozes zarezervovat viac sedadiel ako je dostupnych, a zmysel v rezervacii je ze si rezervujes sedadlo,
cize pocetDostupnych sedadiel sa musi znizit o pocet rezervovanych sedadiel.

------------------
checkIn()
Kontroluje, či sú žiadané sedadlá voľné , tf ??
------------------
checkIn()
"Letenky" - ako ich predstavime ??
*/

var lastFlightNr = 0
var lastReservationNr = 0

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
	ID 					string `json:"ID"`
	FlyFrom				string `json:"flyFrom"`
	FlyTo				string `json:"flyTo"`
	dateTime			string `json:"dateTime"`
	availablePlaces		int    `json:"availablePlaces"`
	BookingStatuses		map[string]string `json:"bookingStatus"`
}

// Reservation represents a reservation of a flight
type Reservation struct {
	ID 					string `json:"ID"`
	CustomerNames		[]string `json:"customerNames"`
	customerEmail		string `json:"customerEmail"`
	FlightNr			string `json:"flightNr"`
	NrOfSeats			int    `json:"nrOfSeats"`
	Status 				string `json:"status"`
}

// Generates flightNr
func generateFlightNr(Org string) string {
	if Org == "Org1MSP" {
		return "EC" + strconv.Itoa(lastFlightNr++)
	}
	return "BS" + strconv.Itoa(lastFlightNr++)
}

// CreateFlight creates a new flight on the ledger
func (t *FlyNetChaincode) createFlight(ctx contractapi.TransactionContextInterface, flyFrom string, flyTo string, dateTime string, seats int) (string, error) {
	callerOrg, err := ctx.GetClientIdentity().GetMSPID()
	
	if err != nil {
		return "", fmt.Errorf("Failed getting caller's org: %v", err)
	}

	if callerOrg != "Org1MSP" && callerOrg != "Org3MSP" {
		return "", fmt.Errorf("The caller is not authorized to invoke the CreateFlight function")
	}

	flightNr := generateFlightNr(callerOrg)
	
	flight := Flight{
		ID: 				flightNr,
		FlyFrom:			flyFrom,
		FlyTo:				flyTo,
		dateTime:			dateTime,
		availablePlaces:	seats,
	}

	flightAsBytes, err := json.Marshal(flight)
	if err != nil {
		return "", fmt.Errorf("Failed converting flight to bytes: %v", err)
	}

	err = ctx.GetStub().PutState(flightNr, flightAsBytes)
	if err != nil {
		return "", fmt.Errorf("Failed to put flight on ledger: %v", err)
	}
	return "Congrats, flight was created successfully", nil
}

// GetAllFlights returns all flights found on the ledger
func (t *FlyNetChaincode) getAllFlights(ctx contractapi.TransactionContextInterface) ([]*FlyNetChaincodeResult, error) || (string, error) {
	resultsIterator, err := ctx.GetStub().GetStateByRange("", "")
	if err != nil {
		return "", fmt.Errorf("Failed getting itterator: %v", err)
	}
	defer resultsIterator.Close()

	results := []*FlyNetChaincodeResult{}

	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return "", fmt.Errorf("Failed getting next key: %v", err)
		}

		// Check the type of the record
		objectType, compositeKeyParts, err := ctx.GetStub().SplitCompositeKey(queryResponse.Key)
		if err != nil {
			return "", fmt.Errorf("Failed splitting composite key: %v", err)
		}
		if objectType != "Flight" {
			continue // Skip non flight records
		}

		flight := new(Flight)
		err = json.Unmarshal(queryResponse.Value, flight)
		if err != nil {
			return "", fmt.Errorf("Failed unmarshalling flight: %v", err)
		}

		flightResult := &FlyNetChaincodeResult{Key: queryResponse.Key, Record: flight}
		results = append(results, flightResult)
	}

	return results, nil
}

// GetAllFlightAsObjects
func (t *FlyNetChaincode) getAllFlightAsObjects(ctx contractapi.TransactionContextInterface) ([]*Flight, error) || (string, error){
	flightResultsIterator, err := ctx.GetStub().GetStateByPartialCompositeKey("Flight", []string{})
	if err != nil {
		return "", fmt.Errorf("Failedto get flights data from ledger: %v", err)
	}
	defer flightResultsIterator.Close()

	flights := []*Flight
	for flightResultsIterator.HasNext() {
		queryResponse, err := flightResultsIterator.Next()
		if err != nil {
			return "", fmt.Errorf("Failed to get next flight: %v", err)
		}

		flight := new(Flight)
		err = json.Unmarshal(queryResponse.Value, flight)
		if err != nil {
			return "", fmt.Errorf("Failed to unmarshal flight: %v", err)
		}

		flights = append(flights, flight)
	}
	return flights, nil
}

// GetFlight returns the flight found on the ledger
func (t *FlyNetChaincode) getFlight(ctx contractapi.TransactionContextInterface, flightNr string) (*FlyNetChaincodeResult, error) || (string, error) {
	flightAsBytes, err := ctx.GetStub().GetState(flightNr)
	if err != nil {
		return "", fmt.Errorf("Failed to read from world state: %v", err)
	}
	if flightAsBytes == nil {
		return "", fmt.Errorf("Flight %s does not exist", flightNr)
	}

	flight := new(Flight)
	err = json.Unmarshal(flightAsBytes, flight)
	if err != nil {
		return "", fmt.Errorf("Failed to unmarshal flight: %v", err)
	}

	flightResult := &FlyNetChaincodeResult{Key: flightNr, Record: flight}
	return flightResult, nil
}

// GetFlightAsObject returns the flight found on the ledger
func (t *FlyNetChaincode) getFlightAsObject(ctx contractapi.TransactionContextInterface, flightNr string) (*Flight, error) || (string, error) {
	flightAsBytes, err := ctx.GetStub().GetState(flightNr)
	if err != nil {
		return "", fmt.Errorf("Failed to read from world state: %v", err)
	}
	if flightAsBytes == nil {
		return "", fmt.Errorf("Flight %s does not exist", flightNr)
	}

	flight := new(Flight)
	err = json.Unmarshal(flightAsBytes, flight)
	if err != nil {
		return "", fmt.Errorf("Failed to unmarshal flight: %v", err)
	}

	return flight, nil
}

// ReserveSeats, can be called only by Org2 (travel agency)
func (t *FlyNetChaincode) reserveSeats(ctx contractapi.TransactionContextInterface, flightNr string, number int, customerNames[] string, customerEmail string) string || error {
	callerOrg, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return fmt.Errorf("Failed getting caller's org: %v", err)
	}

	if callerOrg != "Org2MSP" {
		return fmt.Errorf("The caller is not authorized to invoke the ReserveSeats function")
	}

	flight, err := t.getFlightAsObject(ctx, flightNr)
	if err != nil {
		return fmt.Errorf("Failed getting flight: %v", err)
	}

	if flight.availablePlaces < number {
		return fmt.Errorf("Not enough available places")
	}

	flight.availablePlaces -= number

	flightAsBytes, err := json.Marshal(flight)
	if err != nil {
		return fmt.Errorf("Failed converting flight to bytes: %v", err)
	}

	err = ctx.GetStub().PutState(flightNr, flightAsBytes)
	if err != nil {
		return fmt.Errorf("Failed to put flight on ledger: %v", err)
	}

	// Create a reservation key = reservationNr
	reservationNr := "R" + strconv.Itoa(lastReservationNr++)

	// Create a new reservation
	reservation := Reservation{
		ID:				reservationNr,
		customerNames:	customerNames,
		customerEmail:	customerEmail,
		flightNr:		flightNr,
		numberOfSeats:	number,
		status:			"Pending",
	}

	// Add the reservation to the ledger
	reservationAsBytes, err := json.Marshal(reservation)
	if err != nil {
		return fmt.Errorf("Failed converting reservation to bytes: %v", err)
	}

	err = ctx.GetStub().PutState(reservationNr, reservationAsBytes)
	if err != nil {
		return fmt.Errorf("Failed to put reservation on ledger: %v", err)
	}

	return "Reservation created"
}

// GetReservationAsObject returns the reservation found on the ledger
func (t *FlyNetChaincode) getReservationAsObject(ctx contractapi.TransactionContextInterface, reservationNr string) (*Reservation, error) || (string, error) {
	reservationAsBytes, err := ctx.GetStub().GetState(reservationNr)
	if err != nil {
		return "", fmt.Errorf("Failed to read from world state: %v", err)
	}
	if reservationAsBytes == nil {
		return "", fmt.Errorf("Reservation %s does not exist", reservationNr)
	}

	reservation := new(Reservation)
	err = json.Unmarshal(reservationAsBytes, reservation)
	if err != nil {
		return "", fmt.Errorf("Failed to unmarshal reservation: %v", err)
	}

	return reservation, nil
}

// BookSeats, can be called only by Org1 or Org3 (airline)
func (t *FlyNetChaincode) bookSeats(ctx contractapi.TransactionContextInterface, reservationNr string) string || error {
	callerOrg, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return fmt.Errorf("Failed getting caller's org: %v", err)
	}

	if callerOrg != "Org1MSP" && callerOrg != "Org3MSP" {
		return fmt.Errorf("The caller is not authorized to invoke the BookSeats function")
	}

	reservation, err := t.getReservationAsObject(ctx, reservationNr)
	if err != nil {
		return fmt.Errorf("Failed getting reservation: %v", err)
	}

	flight, err := t.getFlightAsObject(ctx, reservation.flightNr)
	if err != nil {
		return fmt.Errorf("Failed getting flight: %v", err)
	}

	airlinePrefix := flight.ID[0:2]
	if (airlinePrefix == "EC" && callerOrg != "Org1MSP") || (airlinePrefix == "BS" && callerOrg != "Org3MSP") {
		return fmt.Errorf("The caller is not authorized to book seats for this flight")
	}

	reservation.status = "Completed"

	reservationAsBytes, err = json.Marshal(reservation)
	if err != nil {
		return fmt.Errorf("Failed converting reservation to bytes: %v", err)
	}

	err = ctx.GetStub().PutState(reservationNr, reservationAsBytes)
	if err != nil {
		return fmt.Errorf("Failed to put reservation on ledger: %v", err)
	}

	return "Reservation confirmed"
}

// CheckIn, can be called only by Org2 (travel agency) or Client (customer)
// Returns string and array of tickets in case of success, error otherwise 
func (t *FlyNetChaincode) checkIn(ctx contractapi.TransactionContextInterface, reservationNr string, passportIDs[] string) (string, []) || error {
	
}