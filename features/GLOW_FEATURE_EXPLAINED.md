# Proximity-Based Glow Feature

## Summary of Changes

I've modified the threat glow effect to:
1. **Only glow threats within 50km of your location**
2. **Pulse 2x faster** (more noticeable)

## How It Works

### 1. Glow Trigger Logic
**File**: `public/modules/threats.module.js` (lines 140-155)

```javascript
// Only critical threats near user get glow
if (isCritical && isLethal && isNearUser) {
    // Create pulsing glow circle
}
```

**Conditions for glow:**
- ✅ Threat is "critical" (yield ≥ 1000 kg TNT)
- ✅ Drawing the lethal zone (innermost red circle)
- ✅ **NEW**: Threat is within 50km of your location

### 2. Proximity Check
**Function**: `isThreatNearUser()` (lines 230-256)

Uses **Haversine formula** to calculate distance:
```javascript
// Earth's radius = 6371 km
distance = calculateDistance(userLocation, threatLocation)
return distance <= 50; // Within 50km
```

### 3. User Location Tracking
**Function**: `updateUserLocation()` (lines 15-37)

- Requests browser geolocation permission on app start
- Stores your location in `ThreatsModule.userLocation`
- If permission denied → defaults to showing ALL glows

### 4. Pulse Animation (FASTER)
**Function**: `animatePulse()` (lines 258-276)

**Old speed:**
- Opacity change: ±0.02 per frame
- Frame rate: every 50ms
- **Total cycle: ~2 seconds**

**New speed:**
- Opacity change: ±0.04 per frame (2x faster)
- Frame rate: every 30ms (1.67x faster)
- **Total cycle: ~0.6 seconds** (3.3x faster overall!)

## What You'll See

### On First Load:
1. Browser asks for location permission
2. Console shows: `📍 User location updated for glow proximity: {lat: X, lng: Y}`

### Threat Behavior:
| Threat Type | Distance | Yield | Glows? |
|------------|----------|-------|--------|
| Critical (≥1000kg) | < 50km | High | ✅ YES (fast pulse) |
| Critical (≥1000kg) | > 50km | High | ❌ NO |
| Non-critical | Any | Low | ❌ NO |

### Example:
- **test01** (yield=7700kg) in Bengaluru
- **Your location**: Bengaluru
- **Distance**: ~5km
- **Result**: ✅ **GLOWS** (red pulsing circle)

If you're in Delhi (>1500km away):
- **Result**: ❌ **No glow** (too far)

## Customization

Want to change the distance threshold? Edit line 254:
```javascript
return distance <= 50; // Change 50 to your preferred km
```

Want even faster pulse? Edit line 271:
```javascript
}, 30); // Lower number = faster (try 20 for super fast)
```

## Testing

1. **Hard refresh browser** (Ctrl+Shift+R)
2. **Allow location permission** when prompted
3. **Check console** for location confirmation
4. **Look for pulsing red circles** on critical threats near you
