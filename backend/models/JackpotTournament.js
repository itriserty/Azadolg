const mongoose = require('mongoose');

const MatchSchema = new mongoose.Schema({
  stage: {
    type: String,
    enum: ['group_A', 'group_B', 'group_A_tiebreak', 'group_B_tiebreak', 'semi_final_1', 'semi_final_2', 'third_place', 'final'],
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
  winsP1: {
    type: Number,
    default: 0
  },
  winsP2: {
    type: Number,
    default: 0
  },
  winsRequired: {
    type: Number,
    default: 2 // 2 победы для Bo3 (группы, 1/2, за 3-е место), 3 победы для Bo5 (Финал)
  },
  status: {
    type: String,
    enum: ['pending', 'requested', 'reported', 'confirmed'],
    default: 'pending'
  },
  currentLegStatus: {
    type: String,
    enum: ['pending', 'requested', 'reported'],
    default: 'pending'
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
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
  points: { type: Number, default: 0 },
  tiebreakWins: { type: Number, default: 0 }
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
