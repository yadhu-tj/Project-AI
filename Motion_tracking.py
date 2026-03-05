import socketio
import cv2
import base64
import numpy as np

# ⚠️ CHANGE THIS to the local IP address of the laptop running the game
# Example: 'http://192.168.1.5:5000'
SERVER_URL = 'http://localhost:5000'

print(f"📡 INITIALIZING SECURE LINK TO {SERVER_URL}...")

# Initialize the Socket.IO client
sio = socketio.Client()

@sio.event
def connect():
    print("✅ NEURAL LINK ESTABLISHED. INTERCEPTING VIDEO FEED...")

@sio.event
def disconnect():
    print("❌ SIGNAL LOST.")

@sio.on('video_frame')
def on_video_frame(data):
    try:
        # 1. Decode the Base64 text string back into raw bytes
        img_bytes = base64.b64decode(data)
        
        # 2. Convert bytes to a numpy array
        np_arr = np.frombuffer(img_bytes, np.uint8)
        
        # 3. Decode the array into an OpenCV image
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        # 4. Display the image
        cv2.imshow("RAW TELEMETRY", frame)
        
        # Press 'ESC' or 'q' to close the window
        key = cv2.waitKey(1) & 0xFF
        if key == 27 or key == ord('q'):
            sio.disconnect()
            cv2.destroyAllWindows()
            
    except Exception as e:
        print(f"Error decoding frame: {e}")

if __name__ == '__main__':
    try:
        # Create a named window and force it to be FULLSCREEN
        cv2.namedWindow("RAW TELEMETRY", cv2.WND_PROP_FULLSCREEN)
        cv2.setWindowProperty("RAW TELEMETRY", cv2.WND_PROP_FULLSCREEN, cv2.WINDOW_FULLSCREEN)
        
        # Connect to the main game server
        sio.connect(SERVER_URL)
        
        # Keep the script running and listening for frames
        sio.wait()
    except Exception as e:
        print(f"❌ Failed to connect to server: {e}")