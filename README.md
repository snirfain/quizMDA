# MDA Adaptive Learning & Assessment Platform
## מערכת למידה ותרגול מד"א

A comprehensive learning management system for Magen David Adom (MDA) built on Base44 platform.

## Project Structure

```
quizMDA/
├── entities/           # Database entity definitions
├── workflows/          # Backend logic and workflows
├── components/         # UI components (RTL Hebrew)
├── pages/             # Page definitions
├── config/            # Configuration files
└── docs/              # Documentation
```

## Features

### Trainee Interface
- Infinite practice mode with adaptive learning
- Prioritizes mistakes and new material
- Integration with external bot for open-ended questions
- Mobile-first RTL Hebrew interface

### Instructor Interface
- Test Generator with advanced filtering
- PDF export functionality
- Desktop-optimized RTL Hebrew interface

### System Features
- Automatic question suspension (quality control)
- Real-time statistics tracking
- Manager dashboard for review

## Database Schema

### Entities
1. **Content_Hierarchy** - Study material structure
2. **Question_Bank** - Core question repository
3. **Users** - User management
4. **Activity_Log** - Answer tracking and adaptive algorithm

## Getting Started

See individual component documentation for implementation details.
