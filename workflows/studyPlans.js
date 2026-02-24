/**
 * Study Plans Workflow
 * Manage study plans and enrollments
 * Hebrew: תוכניות לימוד
 */

import { entities } from '../config/appConfig';

/**
 * Create a new study plan
 */
export async function createStudyPlan(instructorId, planData) {
  const {
    title,
    description,
    categories = [],
    topics = [],
    order = [],
    daily_goal = 10
  } = planData;

  const plan = await entities.Study_Plans.create({
    instructor_id: instructorId,
    title,
    description,
    categories,
    topics,
    order,
    daily_goal,
    is_active: true,
    created_at: new Date()
  });

  return plan;
}

/**
 * Enroll user in a study plan
 */
export async function enrollUser(userId, planId) {
  // Check if already enrolled
  const existing = await entities.Study_Plan_Enrollments.findOne({
    user_id: userId,
    plan_id: planId
  });

  if (existing) {
    return existing;
  }

  const enrollment = await entities.Study_Plan_Enrollments.create({
    user_id: userId,
    plan_id: planId,
    enrolled_at: new Date(),
    progress: 0
  });

  return enrollment;
}

/**
 * Get plan progress for a user
 */
export async function getPlanProgress(userId, planId) {
  const enrollment = await entities.Study_Plan_Enrollments.findOne({
    user_id: userId,
    plan_id: planId
  });

  if (!enrollment) {
    throw new Error('User not enrolled in this plan');
  }

  const plan = await entities.Study_Plans.findOne({ id: planId });
  if (!plan) {
    throw new Error('Plan not found');
  }

  // Calculate actual progress based on activity
  const progress = await calculatePlanProgress(userId, plan);

  // Update enrollment if progress changed
  if (progress !== enrollment.progress) {
    await entities.Study_Plan_Enrollments.update(enrollment.enrollment_id, {
      progress: progress,
      last_activity: new Date()
    });
  }

  return {
    enrollment,
    plan,
    progress,
    dailyGoal: plan.daily_goal
  };
}

/**
 * Calculate plan progress based on user activity
 */
async function calculatePlanProgress(userId, plan) {
  // Get questions from plan's categories/topics
  const hierarchyQuery = {};
  if (plan.categories && plan.categories.length > 0) {
    hierarchyQuery.category_name = { $in: plan.categories };
  }
  if (plan.topics && plan.topics.length > 0) {
    hierarchyQuery.topic_name = { $in: plan.topics };
  }

  const hierarchies = await entities.Content_Hierarchy.find(hierarchyQuery);
  const hierarchyIds = hierarchies.map(h => h.id);

  const planQuestions = await entities.Question_Bank.find({
    hierarchy_id: { $in: hierarchyIds },
    status: 'active'
  });

  const planQuestionIds = new Set(planQuestions.map(q => q.id));

  // Get user's activity for these questions
  const userActivity = await entities.Activity_Log.find({
    user_id: userId
  });

  const answeredQuestions = new Set(
    userActivity
      .filter(a => planQuestionIds.has(a.question_id))
      .map(a => a.question_id)
  );

  const progress = planQuestions.length > 0
    ? (answeredQuestions.size / planQuestions.length) * 100
    : 0;

  return Math.min(100, Math.round(progress));
}

/**
 * Get recommended questions from a plan
 */
export async function getRecommendedQuestions(userId, planId) {
  const enrollment = await entities.Study_Plan_Enrollments.findOne({
    user_id: userId,
    plan_id: planId
  });

  if (!enrollment) {
    throw new Error('User not enrolled in this plan');
  }

  const plan = await entities.Study_Plans.findOne({ id: planId });
  if (!plan) {
    throw new Error('Plan not found');
  }

  // Build hierarchy filter from plan
  const hierarchyFilters = {};
  if (plan.categories && plan.categories.length > 0) {
    hierarchyFilters.category_name = plan.categories[0]; // Start with first category
  }
  if (plan.topics && plan.topics.length > 0) {
    hierarchyFilters.topic_name = plan.topics[0]; // Start with first topic
  }

  // Use adaptive engine to get questions
  const { getAdaptiveQuestions } = await import('./adaptivePracticeEngine');
  const result = await getAdaptiveQuestions(userId, hierarchyFilters);

  // Limit to daily goal
  const recommended = result.questions.slice(0, plan.daily_goal);

  return {
    questions: recommended,
    dailyGoal: plan.daily_goal,
    progress: enrollment.progress
  };
}

/**
 * Update progress for a plan enrollment
 */
export async function updateProgress(userId, planId) {
  const enrollment = await entities.Study_Plan_Enrollments.findOne({
    user_id: userId,
    plan_id: planId
  });

  if (!enrollment) {
    throw new Error('User not enrolled in this plan');
  }

  const plan = await entities.Study_Plans.findOne({ id: planId });
  if (!plan) {
    throw new Error('Plan not found');
  }

  const progress = await calculatePlanProgress(userId, plan);

  const updateData = {
    progress: progress,
    last_activity: new Date()
  };

  // Mark as completed if progress is 100%
  if (progress >= 100 && !enrollment.completed_at) {
    updateData.completed_at = new Date();
  }

  await entities.Study_Plan_Enrollments.update(enrollment.enrollment_id, updateData);

  return {
    ...enrollment,
    ...updateData
  };
}

/**
 * Get all available study plans
 */
export async function getAvailablePlans() {
  const plans = await entities.Study_Plans.find({
    is_active: true
  }, {
    sort: { created_at: -1 }
  });

  // Enrich with enrollment counts
  const enrichedPlans = [];
  for (const plan of plans) {
    const enrollments = await entities.Study_Plan_Enrollments.find({
      plan_id: plan.plan_id
    });
    
    enrichedPlans.push({
      ...plan,
      enrollmentCount: enrollments.length
    });
  }

  return enrichedPlans;
}

/**
 * Get user's enrolled plans
 */
export async function getUserPlans(userId) {
  const enrollments = await entities.Study_Plan_Enrollments.find({
    user_id: userId
  });

  const plans = [];
  for (const enrollment of enrollments) {
    const plan = await entities.Study_Plans.findOne({
      id: enrollment.plan_id
    });

    if (plan) {
      const progress = await calculatePlanProgress(userId, plan);
      plans.push({
        ...plan,
        enrollment,
        progress
      });
    }
  }

  return plans;
}
