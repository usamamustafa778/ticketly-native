# API Integration Guide

## Configuration

The API base URL is configured in `lib/config.ts` with environment-based support.

### Quick Setup for Physical Devices

**Important**: `localhost` won't work on physical devices! You must use your computer's local IP address.

1. **Find your local IP address:**
   - **Windows**: Run `ipconfig | findstr "IPv4"` in terminal
   - **Mac/Linux**: Run `ifconfig | grep "inet "` in terminal
   - Look for an IP like `192.168.1.148`

2. **Create a `.env` file** in the `ticketly_frontend` directory:
   ```env
   EXPO_PUBLIC_ENV=local
   EXPO_PUBLIC_LOCAL_IP=192.168.1.148
   ```

3. **Restart Expo server** after creating/updating `.env`:
   ```bash
   npx expo start --clear
   ```

### Environment Configuration

The app supports multiple environments via `.env` file:

#### Option 1: Using Local IP (Recommended)
```env
EXPO_PUBLIC_ENV=local
EXPO_PUBLIC_LOCAL_IP=192.168.1.148
```
This automatically generates the correct URL based on platform:
- **Android Emulator**: `http://10.0.2.2:5001/api`
- **iOS Simulator**: `http://localhost:5001/api`
- **Physical Device**: `http://192.168.1.148:5001/api`
- **Web**: `http://localhost:5001/api`

#### Option 2: Full URL Override
```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.148:5001/api
```
This overrides all other settings.

#### Option 3: Environment-Specific
```env
# Local development
EXPO_PUBLIC_ENV=local
EXPO_PUBLIC_LOCAL_IP=192.168.1.148

# Staging
EXPO_PUBLIC_ENV=staging

# Production
EXPO_PUBLIC_ENV=production
```

### Platform-Specific Defaults

- **Web Browser**: `http://localhost:5001/api`
- **Android Emulator**: `http://10.0.2.2:5001/api`
- **iOS Simulator**: `http://localhost:5001/api`
- **Physical Devices**: Requires `EXPO_PUBLIC_LOCAL_IP` or `EXPO_PUBLIC_API_BASE_URL`

### Troubleshooting

**App not connecting on physical device?**
1. Ensure your phone and computer are on the same Wi-Fi network
2. Check that `.env` file has `EXPO_PUBLIC_LOCAL_IP` set correctly
3. Verify backend server is running on port 5001
4. Check firewall isn't blocking port 5001
5. Restart Expo server after changing `.env`

## API Structure

All API calls are organized in the `frontend/lib/api/` directory:

- `client.ts` - Base axios client with token management and refresh logic
- `auth.ts` - Authentication APIs (signup, login, verify-otp, refresh-token, profile, delete)
- `events.ts` - Event APIs (get approved, create, get my, get by id, update, delete)
- `admin.ts` - Admin APIs (get pending events, approve event)

## Token Management

The app automatically handles:
- Access token storage and retrieval
- Automatic token refresh when access token expires
- Token refresh on login page when access token is expired

## Excluded APIs

As per requirements, the following APIs are NOT integrated:
- Get all users
- Get user by id
- Update user by id
- Update ticket status

## Usage Example

```typescript
import { authAPI } from '@/lib/api/auth';
import { eventsAPI } from '@/lib/api/events';

// Login
const response = await authAPI.login({ email, password });

// Get events
const events = await eventsAPI.getApprovedEvents();

// Create event
const newEvent = await eventsAPI.createEvent({
  title: 'My Event',
  description: 'Event description',
  // ... other fields
});
```

