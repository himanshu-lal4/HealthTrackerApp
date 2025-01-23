import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  PermissionsAndroid,
  Platform,
  Alert,
  TouchableOpacity,
} from 'react-native';
import {
  initialize,
  requestPermission,
  writeRecords,
  readRecords,
  getSdkStatus,
  SdkAvailabilityStatus,
  insertRecords,
} from 'react-native-health-connect';
import {accelerometer} from 'react-native-sensors';
import {map, filter} from 'rxjs/operators';
import {NativeModules} from 'react-native';
import {check, request, PERMISSIONS, RESULTS} from 'react-native-permissions';
const {StepCounterModule} = NativeModules;
const App = () => {
  const [steps, setSteps] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [detectedSteps, setDetectedSteps] = useState(0);
  const [isHealthConnectInitialized, setHealthConnectInitialized] =
    useState(false);

  // Request permissions for accessing body sensors
  const requestPermissions = async () => {
    if (Platform.OS === 'android' && Platform.Version >= 29) {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.BODY_SENSORS,
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          setError('Body sensors permission denied');
          Alert.alert(
            'Permission Denied',
            'Body sensors permission is required.',
          );
        }
      } catch (err) {
        console.warn(err);
        setError('Error requesting body sensors permission');
      }
    }
  };

  // Request Health Connect permissions
  const requestHealthPermissions = async () => {
    try {
      const permissionResponse = await requestPermission([
        {accessType: 'read', recordType: 'Steps'},
        {accessType: 'write', recordType: 'Steps'},
      ]);
      if (permissionResponse === 'granted') {
        console.log(
          'Health Connect permission granted for reading/writing steps',
        );
      } else {
        console.log(
          'Health Connect permission denied for reading/writing steps',
        );
        const permissionResponse = await requestPermission([
          {accessType: 'read', recordType: 'Steps'},
          {accessType: 'write', recordType: 'Steps'},
        ]);
      }
    } catch (error) {
      console.log('Error requesting Health Connect permissions', error);
      setError('Error requesting Health Connect permissions');
    }
  };

  // Check Health Connect SDK availability
  const checkHealthConnectSDKAvailability = async () => {
    const status = await getSdkStatus();
    if (status === SdkAvailabilityStatus.SDK_AVAILABLE) {
      console.log('Health Connect SDK is available');
      return true;
    } else {
      console.log('Health Connect SDK is not available');
      setError('Health Connect SDK is unavailable');
      return false;
    }
  };

  // Function to write detected steps to Health Connect
  const writeDetectedSteps = async () => {
    const currentTime = new Date();
    const startTime = new Date(currentTime.getTime() - 1000 * 60 * 60); // 1 hour ago

    try {
      const record = {
        recordType: 'Steps', // Specify the record type as Steps
        startTime: startTime.toISOString(),
        endTime: currentTime.toISOString(),
        count: 1, // Use the detected steps count
      };

      await insertRecords([record]); // Insert the record
      console.log('Successfully wrote detected steps data');
    } catch (error) {
      console.log('Error writing steps data:', error);
    }
  };

  // Function to read steps data from Health Connect
  const readStepsData = async () => {
    const currentTime = new Date();
    const twentyFourHoursAgo = new Date(
      currentTime.getTime() - 24 * 60 * 60 * 1000,
    );
    const currentTimeISO = currentTime.toISOString();
    const twentyFourHoursAgoISO = twentyFourHoursAgo.toISOString();

    try {
      setLoading(true);

      const result = await readRecords('Steps', {
        timeRangeFilter: {
          operator: 'between',
          startTime: twentyFourHoursAgoISO,
          endTime: currentTimeISO,
        },
      });
      console.log('Steps data:', result.records.length);

      if (result.records && result.records.length > 0) {
        const totalSteps = result.records.reduce(
          (sum, record) => sum + record.count,
          0,
        );
        setSteps(totalSteps);
      } else {
        setSteps(0);
      }
      setLoading(false);
    } catch (error) {
      console.log('Error fetching steps data:', error);
      setError('Error fetching steps data');
      setLoading(false);
    }
  };

  // // Detect steps using accelerometer
  // const stepThreshold = 1.6; // Minimum magnitude for step detection (adjustable)
  // const minStepInterval = 600; // Minimum interval between steps in ms (adjustable)
  // const smoothingFactor = 0.2; // Smoothing factor to reduce noise
  // const peakThreshold = 0.5; // Threshold for considering a peak in acceleration (adjustable)

  // // State to keep track of previous accelerometer readings
  // let lastMagnitude = 0;
  // let lastStepTimestamp = 0; // Timestamp of last step detection
  // let smoothedMagnitude = 0; // Smoothed magnitude value

  // // Function to apply smoothing to accelerometer data
  // const smoothData = magnitude => {
  //   smoothedMagnitude =
  //     smoothedMagnitude * (1 - smoothingFactor) + magnitude * smoothingFactor;
  //   return smoothedMagnitude;
  // };

  // // Function to check for a step based on peak detection
  // const isStep = magnitude => {
  //   const currentTime = Date.now();
  //   // Check if the magnitude is above the step threshold
  //   if (magnitude > stepThreshold) {
  //     // Debounce: Ensure enough time has passed since the last detected step
  //     if (currentTime - lastStepTimestamp > minStepInterval) {
  //       // Confirm this is a significant change in acceleration (i.e., a peak)
  //       if (Math.abs(magnitude - lastMagnitude) > peakThreshold) {
  //         lastStepTimestamp = currentTime; // Update the last step timestamp
  //         lastMagnitude = magnitude; // Update last magnitude
  //         return true; // A valid step has been detected
  //       }
  //     }
  //   }
  //   return false;
  // };

  // useEffect(() => {
  //   const stepListener = accelerometer
  //     .pipe(
  //       map(({x, y, z}) => Math.sqrt(x * x + y * y + z * z)), // Calculate the magnitude from x, y, z accelerations
  //       filter(magnitude => magnitude > stepThreshold), // Filter out very small movements
  //     )
  //     .subscribe({
  //       next: magnitude => {
  //         const smoothed = smoothData(magnitude);

  //         // Check if we have detected a valid step
  //         if (isStep(smoothed)) {
  //           setDetectedSteps(prev => prev + 1); // Increment step count
  //         }
  //       },
  //       error: err => {
  //         console.log('Error reading accelerometer data:', err);
  //         setError('Error reading accelerometer data');
  //       },
  //     });

  //   // Clean up the subscription on component unmount
  //   return () => {
  //     stepListener.unsubscribe();
  //   };
  // }, []);
  // Increased thresholds and stricter timing
  const STEP_THRESHOLD = 2.0; // Increased base threshold
  const STEP_DELAY = 400; // Increased minimum time between steps
  const WINDOW_SIZE = 15; // Larger window for better pattern recognition
  const MIN_PEAK_HEIGHT = 1.5; // Minimum peak height for step detection
  const PEAK_THRESHOLD = 1.0; // Increased threshold for peak detection
  const CONSISTENT_STEPS_REQUIRED = 3; // Number of consistent patterns needed to start counting

  // State tracking variables
  let accelerationWindow = [];
  let lastStepTime = 0;
  let lastPeakValue = 0;
  let isAscending = false;
  let consistentPatterns = 0;
  let lastAccelerations = [];

  // Check if the motion pattern resembles walking
  const isWalkingPattern = acceleration => {
    lastAccelerations.push(acceleration);
    if (lastAccelerations.length > 4) {
      lastAccelerations.shift();
    }

    if (lastAccelerations.length < 4) {
      return false;
    }

    // Check for alternating high and low points typical in walking
    const hasPattern = lastAccelerations.some((acc, i) => {
      if (i < 2) {
        return false;
      }
      const diff1 = Math.abs(acc - lastAccelerations[i - 1]);
      const diff2 = Math.abs(
        lastAccelerations[i - 1] - lastAccelerations[i - 2],
      );
      return diff1 > 0.8 && diff2 > 0.8;
    });

    return hasPattern;
  };

  // Moving average with outlier rejection
  const movingAverage = data => {
    if (accelerationWindow.length >= WINDOW_SIZE) {
      accelerationWindow.shift();
    }
    accelerationWindow.push(data);

    // Remove outliers (values more than 2 standard deviations from mean)
    const mean =
      accelerationWindow.reduce((a, b) => a + b, 0) / accelerationWindow.length;
    const stdDev = Math.sqrt(
      accelerationWindow.reduce((a, b) => a + Math.pow(b - mean, 2), 0) /
        accelerationWindow.length,
    );

    const filteredData = accelerationWindow.filter(
      value => Math.abs(value - mean) < 2 * stdDev,
    );

    return filteredData.reduce((a, b) => a + b, 0) / filteredData.length;
  };

  // Enhanced peak detection with pattern recognition
  const isPeak = currentValue => {
    const timeSinceLastStep = Date.now() - lastStepTime;

    if (currentValue > lastPeakValue && currentValue > MIN_PEAK_HEIGHT) {
      isAscending = true;
      lastPeakValue = currentValue;
      return false;
    }

    if (
      isAscending &&
      currentValue < lastPeakValue - PEAK_THRESHOLD &&
      timeSinceLastStep > STEP_DELAY &&
      lastPeakValue > STEP_THRESHOLD
    ) {
      // Check for consistent walking pattern
      if (isWalkingPattern(currentValue)) {
        consistentPatterns++;
      } else {
        consistentPatterns = Math.max(0, consistentPatterns - 1);
      }

      if (consistentPatterns >= CONSISTENT_STEPS_REQUIRED) {
        isAscending = false;
        lastStepTime = Date.now();
        lastPeakValue = 0;
        return true;
      }
    }

    return false;
  };

  // useEffect(() => {
  //   let initialMotionDetected = false;
  //   let motionStartTime = 0;

  //   const subscription = accelerometer
  //     .pipe(
  //       map(({x, y, z}) => {
  //         // Enhanced gravity removal
  //         const gravity = 9.81;
  //         const acceleration = Math.sqrt(x * x + y * y + z * z) - gravity;
  //         return Math.abs(acceleration);
  //       }),
  //       filter(magnitude => {
  //         // Only process significant movements
  //         if (magnitude > 1.0) {
  //           if (!initialMotionDetected) {
  //             initialMotionDetected = true;
  //             motionStartTime = Date.now();
  //             return false;
  //           }
  //           // Require sustained motion for at least 1 second
  //           return Date.now() - motionStartTime > 1000;
  //         }
  //         return false;
  //       }),
  //     )
  //     .subscribe({
  //       next: magnitude => {
  //         try {
  //           const smoothedValue = movingAverage(magnitude);

  //           if (smoothedValue > STEP_THRESHOLD && isPeak(smoothedValue)) {
  //             setSteps(prevSteps => prevSteps + 1);
  //             setDetectedSteps(prev => prev + 1);
  //           }
  //         } catch (err) {
  //           console.error('Error processing accelerometer data:', err);
  //           setError('Error processing step data');
  //         }
  //       },
  //       error: err => {
  //         console.error('Error reading accelerometer:', err);
  //         setError('Error accessing accelerometer');
  //       },
  //     });

  //   return () => subscription.unsubscribe();
  // }, []);

  // Initialize Health Connect and request permissions
  useEffect(() => {
    const initializeHealthConnect = async () => {
      const sdkAvailable = await checkHealthConnectSDKAvailability();
      if (sdkAvailable) {
        await initialize();
        await requestHealthPermissions();
        setHealthConnectInitialized(true);
      }
    };

    initializeHealthConnect();
  }, []);

  useEffect(() => {
    let readStepsDataInterval;

    if (detectedSteps > 0) {
      // writeDetectedSteps();
    }

    if (isHealthConnectInitialized) {
      readStepsDataInterval = setInterval(() => {
        readStepsData();
      }, 10000);
    }

    return () => {
      if (readStepsDataInterval) {
        clearInterval(readStepsDataInterval);
      }
    };
  }, [isHealthConnectInitialized]);

  const requestActivityRecognitionPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const result = await request(PERMISSIONS.ANDROID.ACTIVITY_RECOGNITION);
        if (result === RESULTS.GRANTED) {
          console.log('Activity Recognition permission granted');
        } else {
          console.log('Activity Recognition permission denied');
          Alert.alert(
            'Permission Required',
            'Please grant Activity Recognition permission.',
          );
        }
      } catch (error) {
        console.error('Error requesting permission:', error);
      }
    }
  };
  const [isSubscribed, setIsSubscribed] = useState(false);

  const subscribeToSteps = async () => {
    try {
      await requestActivityRecognitionPermission();
      await StepCounterModule.subscribeToStepData();
      setIsSubscribed(true);
      console.log('Successfully subscribed to step data');
    } catch (error) {
      console.error('Error subscribing to step data:', error);
    }
  };
  const [totalNativeSteps, setTotalNativeSteps] = useState(null);
  const readSteps = async () => {
    try {
      const stepData = await StepCounterModule.readStepData();
      console.log('readSteps ~ stepData', stepData);

      // Check the shape of the returned data
      if (stepData && stepData.length > 0) {
        const totalSteps = stepData.reduce((acc, item) => {
          console.log('Item:', item); // Debug each item
          return acc + (item.steps || 0); // Safe check for steps
        }, 0);
        console.log('totalSteps', totalSteps);
        setTotalNativeSteps(totalSteps);
        // setSteps(totalSteps);
      } else {
        console.log('No step data found.');
      }
    } catch (error) {
      console.error('Error reading step data:', error);
    }
  };

  const unsubscribeFromSteps = async () => {
    try {
      await StepCounterModule.unsubscribe();
      setIsSubscribed(false);
      console.log('Successfully unsubscribed from step data');
    } catch (error) {
      console.error('Error unsubscribing from step data:', error);
    }
  };
  useEffect(() => {
    subscribeToSteps();
  }, []);
  return (
    <View style={styles.container}>
      <Text style={styles.title}>TapHealth Step Tracker</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#007AFF" />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <View style={styles.stepsContainer}>
          <Text style={styles.stepsText}>
            Steps Taken in the Last 24 Hours:{'\n'} By health connect
          </Text>
          <Text style={styles.stepsCount}>{steps !== null ? steps : 0}</Text>
          {/* <View>
            <Text style={styles.stepsText}>
              Steps Detected (Real-time from Sensor):
            </Text>
            <Text style={styles.stepsCount}>{detectedSteps}</Text>
          </View> */}
        </View>
      )}
      <View>
        <TouchableOpacity
          onPress={() => readSteps()}
          style={{
            width: 200,
            height: 50,
            backgroundColor: 'blue',
            marginTop: 20,
            borderRadius: 200,
            justifyContent: 'center',
            alignItems: 'center',
          }}>
          <Text style={{color: '#fff'}}>Read Steps - Native Module</Text>
        </TouchableOpacity>
        {totalNativeSteps && (
          <View>
            <Text style={styles.stepsText}>
              Total steps by native android:{'\n'}{' '}
              <Text style={styles.stepsCount}>{totalNativeSteps}</Text>
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  stepsContainer: {
    marginTop: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepsText: {
    fontSize: 18,
    color: '#555',
    marginBottom: 10,
  },
  stepsCount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  errorText: {
    color: 'red',
    fontSize: 16,
    marginTop: 20,
  },
});

export default App;
