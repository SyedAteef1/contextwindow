import mongoose from 'mongoose';

// "Book a demo" lead capture. Required: name, work email, company, phone.
const RegistrationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  company: { type: String, required: true },
  phone: { type: String, required: true },
  teamSize: { type: String },
  message: { type: String },
  source: { type: String, default: 'book-a-demo' },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.Registration || mongoose.model('Registration', RegistrationSchema);
