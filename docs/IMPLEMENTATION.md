# Implementation Guide
## מדריך יישום

This document provides detailed implementation instructions for deploying the MDA Adaptive Learning & Assessment Platform on Base44.

## Prerequisites

1. Base44 account with developer access
2. MongoDB-compatible database access
3. External MDA Bot API credentials (for open-ended questions)
4. PDF generation service (for test export)

## Step 1: Database Setup

### Create Entities

In Base44, create the following entities using the definitions in `/entities/`:

1. **Content_Hierarchy** (`entities/Content_Hierarchy.js`)
2. **Question_Bank** (`entities/Question_Bank.js`)
3. **Users** (`entities/Users.js`)
4. **Activity_Log** (`entities/Activity_Log.js`)

### Index Configuration

Ensure the following indexes are created for optimal performance:

- `Activity_Log`: Index on `user_id`, `question_id`, and `[user_id, question_id]`
- `Question_Bank`: Index on `status`, `hierarchy_id`, `question_type`
- `Content_Hierarchy`: Index on `category_name`, `topic_name`

## Step 2: Backend Functions Setup

### Deploy Workflows

Upload the workflow files from `/workflows/` as Base44 backend functions:

1. **suspensionLogic.js** - Auto-suspension logic
2. **adaptivePracticeEngine.js** - Adaptive question selection
3. **openEndedValidation.js** - Bot integration
4. **testGenerator.js** - Test creation
5. **managerDashboard.js** - Suspended question management

### Configure Hooks

Set up the following hooks:

- **Activity_Log.onCreate**: Call `onActivityLogCreated` from `suspensionLogic.js`
- **Question_Bank.onUpdate**: Optionally trigger recalculation if needed

### Environment Variables

Set the following environment variables in Base44:

```
MDA_BOT_API_URL=https://your-bot-api-url.com/validate
MDA_BOT_API_KEY=your-api-key-here
```

## Step 3: Frontend Components

### Deploy Pages

Create the following pages in Base44:

1. **TraineeDashboard** (`pages/TraineeDashboard.jsx`)
   - Route: `/practice`
   - Access: `trainee` role

2. **InstructorDashboard** (`pages/InstructorDashboard.jsx`)
   - Route: `/instructor`
   - Access: `instructor`, `admin` roles

3. **ManagerDashboardPage** (`pages/ManagerDashboardPage.jsx`)
   - Route: `/manager`
   - Access: `admin` role

### Deploy Components

Upload components from `/components/`:

- `TraineePracticeSession.jsx`
- `TestGenerator.jsx`
- `ManagerDashboard.jsx`

### RTL Configuration

Ensure Base44 is configured for RTL:

1. Set app direction to RTL in app settings
2. Import and use RTL helpers from `/utils/rtlHelpers.js`
3. Verify Hebrew font rendering

## Step 4: Permissions Configuration

### Entity Permissions

Configure entity-level permissions:

- **Content_Hierarchy**: Read (authenticated), Write (instructor, admin)
- **Question_Bank**: Read (authenticated), Write (instructor, admin)
- **Users**: Read (authenticated), Write (admin only)
- **Activity_Log**: Read (authenticated), Create (authenticated), Update/Delete (admin)

### Role-Based Access

Implement role checking in pages:

```javascript
const user = await auth.getCurrentUser();
if (user.role !== 'instructor' && user.role !== 'admin') {
  redirect('/unauthorized');
}
```

## Step 5: Integration Points

### External Bot API

The open-ended question validation requires an external API endpoint:

**Endpoint**: `POST /validate`

**Request Body**:
```json
{
  "question_id": "string",
  "question_text": "string",
  "user_answer_text": "string"
}
```

**Response**:
```json
{
  "feedback": "string",
  "score": 0.0-1.0,
  "suggestions": ["string"]
}
```

### PDF Generation

For test export, integrate with a PDF generation service:

- Option 1: Use Base44's built-in PDF generation (if available)
- Option 2: Integrate with external service (e.g., Puppeteer, PDFKit)
- Option 3: Generate HTML and use browser print-to-PDF

## Step 6: Testing

### Test Scenarios

1. **Suspension Logic**
   - Create question with 20+ attempts
   - Set success rate < 70%
   - Verify auto-suspension

2. **Adaptive Practice**
   - Answer questions incorrectly
   - Verify mistakes appear first in next session
   - Verify new questions appear after mistakes

3. **Open-Ended Questions**
   - Submit open-ended answer
   - Verify bot feedback appears
   - Test self-assessment flow

4. **Test Generator**
   - Apply filters
   - Generate test
   - Verify PDF export

5. **Manager Dashboard**
   - View suspended questions
   - Reactivate questions
   - Verify statistics

## Step 7: Performance Optimization

### Database Optimization

- Ensure indexes are created (see Step 1)
- Consider pagination for large result sets
- Cache filter options where appropriate

### Frontend Optimization

- Lazy load components
- Implement virtual scrolling for long lists
- Optimize image loading for media attachments

## Step 8: Monitoring

### Key Metrics to Monitor

1. **Question Statistics**
   - Average success rate per question type
   - Suspension rate
   - Questions per hierarchy

2. **User Activity**
   - Practice sessions per user
   - Average questions per session
   - Time spent per question

3. **System Health**
   - Bot API response times
   - Database query performance
   - Error rates

## Troubleshooting

### Common Issues

1. **Questions not suspending**
   - Check Activity_Log hook configuration
   - Verify suspension thresholds in config
   - Check question status updates

2. **Adaptive algorithm not working**
   - Verify Activity_Log entries are created
   - Check user_id references
   - Ensure indexes are created

3. **RTL layout issues**
   - Verify direction: 'rtl' in styles
   - Check font support for Hebrew
   - Test on mobile devices

4. **Bot integration failing**
   - Verify API credentials
   - Check network connectivity
   - Review error logs

## Support

For issues or questions, refer to:
- Base44 documentation: https://docs.base44.com
- Project README: `/README.md`
- Entity definitions: `/entities/`
