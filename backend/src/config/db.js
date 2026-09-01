import dns from 'dns';
import mongoose from 'mongoose';

/* Node's own DNS resolver (not the OS's) sometimes can't reach the
   SRV records mongodb+srv:// needs, even when `nslookup` (which goes
   through the OS resolver directly) works fine for the same host —
   a known Node-on-Windows quirk. Pointing Node's resolver at a public
   DNS server sidesteps it. */
dns.setServers(['8.8.8.8', '1.1.1.1']);

export async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  }
}
