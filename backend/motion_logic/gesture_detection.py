import math

def calculate_arm_angle(shoulder, wrist):
    """Calculates relative arm lift (0 = Down, 180 = Up) with Deadzone"""
    # Adjusted for full range (Hands Down to Hands Up)
    # Offset 0.4 maps ~T-pose (diff=0) to ~90 deg
    
    # DEADZONE (To prevent walking jitter)
    lift_raw = (shoulder.y - wrist.y) + 0.4
    
    if lift_raw < 0.30: # Threshold: Increased to 0.30 to fix Left Hand jitter
        return 0
        
    final_angle = max(0, min(180, lift_raw * 240))
    return int(final_angle)

def calculate_wiper_angle(elbow, wrist):
    """Calculates lateral forearm angle (-90 Left to +90 Right) relative to Elbow"""
    # dx: + is Right, - is Left (relative to image)
    # dy: + is Down, - is Up
    dx = wrist.x - elbow.x
    dy = wrist.y - elbow.y
    
    angle = math.degrees(math.atan2(dx, -dy))
    return int(angle)
