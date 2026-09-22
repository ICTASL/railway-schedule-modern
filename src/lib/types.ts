/** Clean domain model used by the UI. Database column names and quirks stay inside `lib/db/`. */

export interface Station {
  id: string;
  code: string;
  name: string;
}

export interface TrainClass {
  id: string;
  name: string;
}

export interface DirectTrain {
  id: string;
  number: string;
  name: string;
  type: string;
  frequency: string;
  startStation: string;
  arrivalTime: string;
  departureTime: string;
  /** Where the train terminates. */
  finalStation: string;
  arrivalTimeAtFinalStation: string;
  /** The traveller's destination. */
  endStation: string;
  arrivalTimeAtEndStation: string;
  classes: TrainClass[];
}

export interface ConnectingLeg {
  trainNumber: string;
  trainName: string;
  startStation: string;
  startTime: string;
  endStation: string;
  endTime: string;
  /** The traveller changes trains at this leg's end station. */
  isTransit: boolean;
  classes: TrainClass[];
}

export interface ConnectingJourney {
  startStation: string;
  startArrivalTime: string;
  startDepartureTime: string;
  endStation: string;
  endArrivalTime: string;
  legs: ConnectingLeg[];
}

export interface Price {
  className: string;
  distanceKm: string;
  priceLkr: string;
}

export interface JunctionSuggestion {
  junctionStation: string;
  fromStation: string;
  toStation: string;
}

export interface SearchOutcome {
  /** The backend echoes the query back with resolved station names. */
  query: {
    startStation: string;
    endStation: string;
    /** yyyy-MM-dd */
    date: string;
    startTime: string;
    endTime: string;
  };
  /** Backend status: `2000` results found, `2001` nothing found. */
  statusCode: string;
  resultCount: string;
  directTrains: DirectTrain[];
  connectingJourneys: ConnectingJourney[];
}
