import mongoose from 'mongoose';

const RegistrationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  whatsapp: { type: String },
  twitter: { type: String },
  github: { type: String },
  deploymentLink: { type: String, required: true },
  architectureCheck: { type: String, required: true },
  currentBuild: { type: String, required: true },
  frictionPoint: { type: String, required: true },
  locationStatus: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.Registration || mongoose.model('Registration', RegistrationSchema);
