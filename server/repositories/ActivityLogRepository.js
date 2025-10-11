const { eq, desc, and, sql } = require('drizzle-orm');
const { activityLogs, users } = require('../../shared/schema');

/**
 * ActivityLogRepository - Data access layer for activity logs
 */
class ActivityLogRepository {
  constructor(db) {
    this.db = db;
  }

  async logActivity(userId, activityType, activityData, isPublic = true) {
    const result = await this.db.insert(activityLogs)
      .values({
        userId,
        activityType,
        activityData,
        isPublic: isPublic ? 1 : 0,
      })
      .returning();
    return result[0];
  }

  async getRecentActivity(limit = 50) {
    return await this.db.select({
      id: activityLogs.id,
      userId: activityLogs.userId,
      activityType: activityLogs.activityType,
      activityData: activityLogs.activityData,
      createdAt: activityLogs.createdAt,
      userName: users.displayName,
      userEmail: users.email,
    })
    .from(activityLogs)
    .innerJoin(users, eq(activityLogs.userId, users.id))
    .where(eq(activityLogs.isPublic, 1))
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit);
  }

  async getUserActivity(userId, limit = 50) {
    return await this.db.select()
      .from(activityLogs)
      .where(eq(activityLogs.userId, userId))
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit);
  }

  async getActivityByType(activityType, limit = 50) {
    return await this.db.select({
      id: activityLogs.id,
      userId: activityLogs.userId,
      activityType: activityLogs.activityType,
      activityData: activityLogs.activityData,
      createdAt: activityLogs.createdAt,
      userName: users.displayName,
      userEmail: users.email,
    })
    .from(activityLogs)
    .innerJoin(users, eq(activityLogs.userId, users.id))
    .where(and(
      eq(activityLogs.isPublic, 1),
      eq(activityLogs.activityType, activityType)
    ))
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit);
  }
}

module.exports = ActivityLogRepository;
