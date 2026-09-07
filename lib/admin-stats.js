import { execute } from './db.js';

export async function buildAdminStats() {
  try {
    const u = await execute("SELECT COUNT(*) as count FROM users");
    const e = await execute("SELECT COUNT(*) as count FROM epreuves");
    const countUsers = u.rows?.[0]?.count || 0;
    const countEpreuves = e.rows?.[0]?.count || 0;

    return {
      success: true,
      stats: {
        totalUsers: countUsers,
        totalEpreuves: countEpreuves,
        users: countUsers,
        epreuves: countEpreuves
      },
      updatedAt: new Date().toISOString()
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      stats: { totalUsers: 0, totalEpreuves: 0, users: 0, epreuves: 0 }
    };
  }
}

export async function getAdminStats() {
  return buildAdminStats();
}
