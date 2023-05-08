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
        const startKey = '';
        const endKey = ''; // the maximum unicode value

        const iterator = await ctx.stub.getStateByRange(startKey, endKey);
        const results = [];

        let res = await iterator.next();
        while (!res.done) {
            const item = {
                key: res.value.key,
                value: JSON.parse(res.value.value.toString('utf8'))
            };
            try {
                const is = item.value.flightNr;
                results.push(item);
            } catch (err) {
            }

            res = await iterator.next();
        }

        await iterator.close();
        return results;

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

        if (Number(flight.availablePlaces) < Number(number)) {
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

        return 'Reservation created' + reservationNr;
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
        const callerOrg = ctx.clientIdentity.getMSPID();

        if (callerOrg !== 'Org2MSP') {
            throw new Error('The caller is not authorized to invoke the CheckIn function');
        }

        const reservation = await this.getReservation(ctx, reservationNr);
        const flight = await this.getFlight(ctx, reservation.FlightNr);

        // Check if passport IDs match the customerNames in the reservation
        if (passportIDs.length !== reservation.CustomerNames.length) {
            throw new Error('The number of passport IDs does not match the number of customers');
        }

        reservation.CustomerNames.forEach((customerName, index) => {
            if (customerName !== passportIDs[index]) {
                throw new Error('The passport IDs do not match the customer names');
            }
        });

        //Chage status to checked-in
        reservation.Status = 'CheckedIn';

        await ctx.stub.putState(reservationNr, Buffer.from(JSON.stringify(reservation)));

        // Json object of tickets
        const tickets = {
            ReservationNr: reservationNr,
            CustomerNames: reservation.CustomerNames,
            CustomerEmail: reservation.CustomerEmail,
            FlightNr: reservation.FlightNr,
            FlyFrom: flight.FlyFrom,
            FlyTo: flight.FlyTo,
            dateTime: flight.dateTime,
            NrOfSeats: reservation.NrOfSeats
        };

        return tickets;
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