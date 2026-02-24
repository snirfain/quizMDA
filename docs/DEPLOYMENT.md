# Deployment Guide
## מדריך פריסה

## Quick Start

1. **Set up Base44 project**
   ```bash
   # Create new Base44 app
   # Configure MongoDB connection
   # Set up authentication
   ```

2. **Import entities**
   - Go to Base44 entity manager
   - Create entities from `/entities/*.js` files
   - Configure indexes as specified

3. **Deploy backend functions**
   - Upload all files from `/workflows/` as backend functions
   - Configure environment variables
   - Set up hooks

4. **Deploy frontend**
   - Upload pages from `/pages/`
   - Upload components from `/components/`
   - Configure routes and permissions

5. **Configure integrations**
   - Set MDA Bot API credentials
   - Configure PDF generation service

## Detailed Steps

### Phase 1: Database Setup

1. Create `Content_Hierarchy` entity
2. Create `Question_Bank` entity
3. Create `Users` entity
4. Create `Activity_Log` entity
5. Create indexes (see IMPLEMENTATION.md)
6. Seed initial data (optional)

### Phase 2: Backend Deployment

1. Upload `workflows/suspensionLogic.js`
2. Upload `workflows/adaptivePracticeEngine.js`
3. Upload `workflows/openEndedValidation.js`
4. Upload `workflows/testGenerator.js`
5. Upload `workflows/managerDashboard.js`
6. Configure hooks:
   - `Activity_Log.onCreate` → `onActivityLogCreated`
7. Set environment variables

### Phase 3: Frontend Deployment

1. Upload `components/TraineePracticeSession.jsx`
2. Upload `components/TestGenerator.jsx`
3. Upload `components/ManagerDashboard.jsx`
4. Upload `pages/TraineeDashboard.jsx`
5. Upload `pages/InstructorDashboard.jsx`
6. Upload `pages/ManagerDashboardPage.jsx`
7. Upload `utils/rtlHelpers.js`
8. Upload `utils/answerValidation.js`
9. Upload `config/appConfig.js`

### Phase 4: Configuration

1. **Routes:**
   - `/practice` → TraineeDashboard (role: trainee)
   - `/instructor` → InstructorDashboard (role: instructor, admin)
   - `/manager` → ManagerDashboardPage (role: admin)

2. **Permissions:**
   - Configure entity-level permissions
   - Set up role-based access control

3. **RTL Support:**
   - Enable RTL in app settings
   - Verify Hebrew font rendering
   - Test on mobile devices

### Phase 5: Integration

1. **MDA Bot API:**
   - Get API credentials
   - Set `MDA_BOT_API_URL`
   - Set `MDA_BOT_API_KEY`
   - Test connection

2. **PDF Generation:**
   - Choose PDF service
   - Integrate export function
   - Test PDF generation

### Phase 6: Testing

1. Test suspension logic
2. Test adaptive practice
3. Test open-ended questions
4. Test test generator
5. Test manager dashboard
6. Test on mobile devices
7. Test RTL layout

### Phase 7: Launch

1. Create initial admin user
2. Import question bank
3. Set up content hierarchy
4. Train instructors
5. Announce to trainees

## Environment Variables

Required:
```
MDA_BOT_API_URL=https://api.example.com/validate
MDA_BOT_API_KEY=your-api-key
```

Optional:
```
NODE_ENV=production
LOG_LEVEL=info
```

## Rollback Plan

If issues occur:

1. Disable new features via feature flags
2. Revert to previous version
3. Restore database backup
4. Review error logs

## Monitoring

Set up monitoring for:
- API response times
- Error rates
- Database performance
- User activity
- Suspension rates

## Support Contacts

- Technical: [Your contact]
- MDA Bot API: [Bot API support]
- Base44 Support: https://docs.base44.com
