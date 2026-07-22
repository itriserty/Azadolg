const mongoose = require('mongoose');

const MatchSchema = new mongoose.Schema({
  stage: {
    type: String,
    enum: ['group_A', 'group_B', 'semi_final_1', 'semi_final_2', 'third_place', 'final'],
    required: true
  },
  round: {
    type: Number,
    default: 1
  },
  player1: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  player2: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'reported', 'confirmed'],
    default: 'pending'
  },
  reportedWinner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  confirmedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  winner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, { timestamps: true });

const StandingsItemSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  points: { type: Number, default: 0 }
}, { _id: false });

const FinalPlacementSchema = new mongoose.Schema({
  rank: { type: Number, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  prize: { type: Number, default: 0 }
}, { _id: false });

const JackpotTournamentSchema = new mongoose.Schema({
  title: {
    type: String,
    default: 'Еженедельный Турнир 6 Игроков'
  },
  jackpotPool: {
    type: Number,
    required: true,
    default: 0
  },
  status: {
    type: String,
    enum: ['registration', 'group_stage', 'playoffs', 'completed'],
    default: 'registration'
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  groups: {
    groupA: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    groupB: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  standings: {
    groupA: [StandingsItemSchema],
    groupB: [StandingsItemSchema]
  },
  matches: [MatchSchema],
  finalPlacements: [FinalPlacementSchema]
}, {
  timestamps: true
});

module.exports = mongoose.model('JackpotTournament', JackpotTournamentSchema);
