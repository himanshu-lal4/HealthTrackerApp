import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  PermissionsAndroid,
  Platform,
  Alert,
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

  // Detect steps using accelerometer
  const stepThreshold = 1.6; // Minimum magnitude for step detection (adjustable)
  const minStepInterval = 600; // Minimum interval between steps in ms (adjustable)
  const smoothingFactor = 0.2; // Smoothing factor to reduce noise
  const peakThreshold = 0.5; // Threshold for considering a peak in acceleration (adjustable)

  // State to keep track of previous accelerometer readings
  let lastMagnitude = 0;
  let lastStepTimestamp = 0; // Timestamp of last step detection
  let smoothedMagnitude = 0; // Smoothed magnitude value

  // Function to apply smoothing to accelerometer data
  const smoothData = magnitude => {
    smoothedMagnitude =
      smoothedMagnitude * (1 - smoothingFactor) + magnitude * smoothingFactor;
    return smoothedMagnitude;
  };

  // Function to check for a step based on peak detection
  const isStep = magnitude => {
    const currentTime = Date.now();
    // Check if the magnitude is above the step threshold
    if (magnitude > stepThreshold) {
      // Debounce: Ensure enough time has passed since the last detected step
      if (currentTime - lastStepTimestamp > minStepInterval) {
        // Confirm this is a significant change in acceleration (i.e., a peak)
        if (Math.abs(magnitude - lastMagnitude) > peakThreshold) {
          lastStepTimestamp = currentTime; // Update the last step timestamp
          lastMagnitude = magnitude; // Update last magnitude
          return true; // A valid step has been detected
        }
      }
    }
    return false;
  };

  useEffect(() => {
    const stepListener = accelerometer
      .pipe(
        map(({x, y, z}) => Math.sqrt(x * x + y * y + z * z)), // Calculate the magnitude from x, y, z accelerations
        filter(magnitude => magnitude > stepThreshold), // Filter out very small movements
      )
      .subscribe({
        next: magnitude => {
          const smoothed = smoothData(magnitude);

          // Check if we have detected a valid step
          if (isStep(smoothed)) {
            setDetectedSteps(prev => prev + 1); // Increment step count
          }
        },
        error: err => {
          console.log('Error reading accelerometer data:', err);
          setError('Error reading accelerometer data');
        },
      });

    // Clean up the subscription on component unmount
    return () => {
      stepListener.unsubscribe();
    };
  }, []);
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
    if (detectedSteps > 0) {
      writeDetectedSteps();
    }
    if (isHealthConnectInitialized) {
      readStepsData();
    }
  }, [detectedSteps, isHealthConnectInitialized]);

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
            Steps Taken in the Last 24 Hours:
          </Text>
          <Text style={styles.stepsCount}>{steps !== null ? steps : 0}</Text>
          <Text style={styles.stepsText}>
            Steps Detected (Real-time from Sensor):
          </Text>
          <Text style={styles.stepsCount}>{detectedSteps}</Text>
        </View>
      )}
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
