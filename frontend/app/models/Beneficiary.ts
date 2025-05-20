// models/Beneficiary.ts
import mongoose from 'mongoose';

const BeneficiarySchema = new mongoose.Schema({
  ownerAddress: { type: String, required: true },
  beneAddress: { type: String, required: true },
  allocation: { type: Number, required: true },
  walletAddress: { type: String, required: true },
  inactivityDuration: { type: Number, required: true },
  inactivityUnit: { 
    type: String, 
    required: true,
    enum: ['minutes', 'hours', 'days']
  },
  lastCheckin: { type: Date, default: Date.now },
});

export default mongoose.models.Beneficiary || 
  mongoose.model('Beneficiary', BeneficiarySchema);