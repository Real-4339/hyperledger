'use strict';

const { Contract } = require('fabric-contract-api');

let lastFlightNr = 0;
let lastReservationNr = 0;

class FlyNetChaincode extends Contract {
    async createFlight(ctx, flyFrom, flyTo, dateTime, seats) {
        const callerOrg = ctx.clientIdentity.getMSPID();

        if (callerOrg !== 'Org1MSP' && callerOrg !== 'Org3MSP') {
            throw new Error('The caller is not authorized to invoke the CreateFlight function');
        }

        const flightNr = this.generateFlightNr(callerOrg);
        lastFlightNr += 1;

        const flight = {
            ID: flightNr,
            FlyFrom: flyFrom,
            FlyTo: flyTo,
            dateTime: dateTime,
            availablePlaces: seats,
            BookingStatuses: {}
        };

        await ctx.stub.putState(flightNr, Buffer.from(JSON.stringify(flight)));

        return 'Congrats, flight was created successfully';
    }

    async getAllFlights(ctx) {
        const flightResultsIterator = await ctx.stub.getStateByPartialCompositeKey('Flight', []);

        const flights = [];
        for await (const queryResponse of flightResultsIterator) {
            const flight = JSON.parse(queryResponse.value.toString('utf8'));
            flights.push(flight);
        }

        return flights;
    }

    async getFlight(ctx, flightNr) {
        const flightAsBytes = await ctx.stub.getState(flightNr);

        if (!flightAsBytes || flightAsBytes.length === 0) {
            throw new Error(`Flight ${flightNr} does not exist`);
        }

        const flight = JSON.parse(flightAsBytes.toString('utf8'));
        return flight;
    }

    async reserveSeats(ctx, flightNr, number, customerNames, customerEmail) {
        const callerOrg = ctx.clientIdentity.getMSPID();

        if (callerOrg !== 'Org2MSP') {
            throw new Error('The caller is not authorized to invoke the ReserveSeats function');
        }

        const flight = await this.getFlight(ctx, flightNr);

        if (flight.availablePlaces < number) {
            throw new Error('Not enough available places');
        }

        flight.availablePlaces -= number;

        await ctx.stub.putState(flightNr, Buffer.from(JSON.stringify(flight)));

        const reservationNr = 'R' + lastReservationNr;
        lastReservationNr += 1;

        const reservation = {
            ID: reservationNr,
            CustomerNames: customerNames,
            CustomerEmail: customerEmail,
            FlightNr: flightNr,
            NrOfSeats: number,
            Status: 'Pending'
        };

        await ctx.stub.putState(reservationNr, Buffer.from(JSON.stringify(reservation)));

        return 'Reservation created';
    }

    async getReservation(ctx, reservationNr) {
        const reservationAsBytes = await ctx.stub.getState(reservationNr);

        if (!reservationAsBytes || reservationAsBytes.length === 0) {
            throw new Error(`Reservation ${reservationNr} does not exist`);
        }

        const reservation = JSON.parse(reservationAsBytes.toString('utf8'));
        return reservation;
    }

    async bookSeats(ctx, reservationNr) {
        const callerOrg = ctx.clientIdentity.getMSPID();

        if (callerOrg !== 'Org1MSP' && callerOrg !== 'Org3MSP') {
            throw new Error('The caller is not authorized to invoke the BookSeats function');
        }

        const reservation = await this.getReservation(ctx, reservationNr);
        const flight = await this.getFlight(ctx, reservation.FlightNr);

        const airlinePrefix = flight.ID.substring(0, 2);
        if ((airlinePrefix === 'EC' && callerOrg !== 'Org1MSP') || (airlinePrefix === 'BS' && callerOrg !== 'Org3MSP')) {
            throw new Error('The caller is not authorized to book seats for this flight');
        }
        reservation.Status = 'Completed';

        await ctx.stub.putState(reservationNr, Buffer.from(JSON.stringify(reservation)));

        return 'Reservation confirmed';
    }

    async checkIn(ctx, reservationNr, passportIDs) {
        // This function is not implemented in the provided Go code, so it needs to be implemented separately in Node.js.
        return 'CheckIn';
    }

    generateFlightNr(org) {
        if (org === 'Org1MSP') {
            return 'EC' + lastFlightNr;
        } else {
            return 'BS' + lastFlightNr;
        }
    }
}

module.exports = FlyNetChaincode;