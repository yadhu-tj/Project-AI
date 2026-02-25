import math
from config import ARM_LIFT_OFFSET, ARM_DEADZONE, ARM_ANGLE_MULTIPLIER

def calculate_arm_angle(shoulder, wrist):
    """Calculates relative arm lift (0 = Down, 180 = Up) with Deadzone"""
    # ARM_LIFT_OFFSET maps ~T-pose (diff=0) to ~90 deg
    lift_raw = (shoulder.y - wrist.y) + ARM_LIFT_OFFSET

    if lift_raw < ARM_DEADZONE:
        return 0

    final_angle = max(0, min(180, lift_raw * ARM_ANGLE_MULTIPLIER))
    return int(final_angle)

def calculate_wiper_angle(elbow, wrist):
    """Calculates lateral forearm angle (-90 Left to +90 Right) relative to Elbow"""
    # dx: + is Right, - is Left (relative to image)
    # dy: + is Down, - is Up
    dx = wrist.x - elbow.x
    dy = wrist.y - elbow.y

    angle = math.degrees(math.atan2(dx, -dy))
    return int(angle)

