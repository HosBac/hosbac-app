import { buildAdminStats } from '../lib/admin-stats.js';

export default async function handler(req, res) {
  try {
    const data = await buildAdminStats();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
