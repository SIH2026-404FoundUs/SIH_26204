import mongoose from "mongoose";

// destination_demand — schema-workplan.md §1. Aggregated nightly from trip
// intent; the demand side of the room-demand-gap computation.
const destinationDemandSchema = new mongoose.Schema({
  destId: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  travellers: {
    type: Number,
  },
  estimatedRooms: {
    type: Number,
  },
  generatedFrom: {
    type: String,
    enum: ["trip_planning"],
    default: "trip_planning",
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

const DestinationDemand = mongoose.model("DestinationDemand", destinationDemandSchema);

export default DestinationDemand;
