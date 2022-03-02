/* eslint-disable no-undef */
import {
	Alert,
	Box,
	Button,
	Container,
	Stack,
	Typography,
} from "@mui/material";
import { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import "./Stretch.css";
import {
	MAX_EYE_DISTANCE,
	PREDICTION_CONFIDENCE,
	STRETCH_TIME,
} from "./utilities/constValues";
import {
	drawCameraIntoCanvas,
	drawKeypoints,
	drawSkeleton,
} from "./utilities/drawPose";
import { displayTime, getEyeDistance } from "./utilities/utilities";

const poseEmojis = {
	LEFT: "⬅️",
	RIGHT: "➡️",
	UP: "⬆️",
	IDLE: "🧘🏻",
};

let beginClicked = false;
let brain;
let currentPose = "";
let tooClose = false;

const Stretch = () => {
	const canvasRef = useRef(null);
	const poseIntervalIDsRef = useRef({});
	const webcamRef = useRef(null);

	const [canvas, setCanvas] = useState(null);
	const [ctx, setCtx] = useState(null);
	const [modelLoaded, setModelLoaded] = useState(false);
	const [poses, setPoses] = useState([]);

	const [poseTimes, setPoseTimes] = useState({
		LEFT: 0,
		UP: 0,
		RIGHT: 0,
	});
	const [stretchComplete, setStretchComplete] = useState(false);
	const [video, setVideo] = useState(null);

	useEffect(() => {
		if (canvasRef.current) {
			setCanvas(canvasRef.current);
			setCtx(canvasRef.current.getContext("2d"));
		}
	}, [canvasRef]);

	useEffect(() => {
		if (webcamRef.current) setVideo(webcamRef.current.video);
	}, [webcamRef]);

	useEffect(() => {
		if (
			poseTimes &&
			Object.values(poseTimes).every((poseTime) => poseTime >= STRETCH_TIME)
		)
			setStretchComplete(true);
	}, [poseTimes]);

	//// POSENET ////

	// eslint-disable-next-line no-undef
	const setupPoseNet = () => {
		const options = {
			maxPoseDetections: 1,
			detectionType: "single",
		};
		const poseNet = ml5.poseNet(video, options, () => {
			console.log("🧑🏻‍💻 Model ready");
			setModelLoaded(true);
		});
		poseNet.on("pose", gotPoses);
	};

	const gotPoses = (poses) => {
		setPoses(poses);
		drawCameraIntoCanvas(ctx, video);
		drawKeypoints(ctx, poses);
		drawSkeleton(ctx, poses);
	};

	if (video && canvas && !modelLoaded) setupPoseNet();

	//// NEURAL NETWORK ////

	const setupNN = () => {
		const options = {
			inputs: 34,
			outputs: 4,
			task: "classification",
		};
		brain = ml5.neuralNetwork(options);
		const modelInfo = {
			model: "model.json",
			metadata: "model_meta.json",
			weights: "model.weights.bin",
		};
		brain.load(modelInfo, () => {
			console.log("🧑🏻‍💻 Model loaded!");
		});
	};

	if (!brain) setupNN();

	const classify = () => {
		const pose = poses[0].pose;
		if (pose) {
			let inputs = [];
			for (let i = 0; i < pose.keypoints.length; i++) {
				let x = pose.keypoints[i].position.x;
				let y = pose.keypoints[i].position.y;
				inputs.push(x);
				inputs.push(y);
			}
			brain.classify(inputs, gotResult);
		}
	};

	const gotResult = (error, results) => {
		if (results && results[0].confidence > PREDICTION_CONFIDENCE) {
			currentPose = results[0].label.toUpperCase();
			if (!poseIntervalIDsRef.current[currentPose]) {
				poseIntervalIDsRef.current[currentPose] = setInterval(() => {
					// set timer for current pose
					setPoseTimes((prevTimes) => {
						if (prevTimes[currentPose] < STRETCH_TIME)
							prevTimes[currentPose] += 4;
						return prevTimes;
					}, 4);
				});
				poseEmojis.keys().forEach((pose) => {
					if (
						pose !== currentPose &&
						pose !== "IDLE" &&
						poseIntervalIDsRef.current[pose]
					) {
						clearInterval(poseIntervalIDsRef.current[pose]);
					}
				});
			}
		}
	};

	if (beginClicked) classify();

	const buttonClick = (e) => {
		e.preventDefault();
		const action = e.target.name;
		switch (action) {
			case "begin":
				if (brain && !brain.neuralNetwork.isTrained) {
					console.log("🧑🏻‍💻 Model not trained yet!");
				} else if (getEyeDistance(poses[0].pose) > MAX_EYE_DISTANCE) {
					tooClose = true;
				} else {
					tooClose = false;
					beginClicked = true;
				}
				break;
			case "reset":
				beginClicked = false;
				setStretchComplete(false);
				poseTime = {
					LEFT: 0,
					RIGHT: 0,
					UP: 0,
				};
				break;
			default:
		}
	};

	return (
		<div className="Stretch">
			<Box
				sx={{
					bgcolor: "background.paper",
					pt: 4,
					pb: 4,
				}}
			>
				<Container maxWidth="sm">
					<Typography
						component="h1"
						variant="h2"
						align="center"
						color="text.primary"
						gutterBottom
					>
						Let's Stretch!🙆🏻‍♂️
					</Typography>
					<Typography
						variant="h5"
						align="center"
						color="text.secondary"
						paragraph
					>
						If you're here, that means...it's time to stretch! Since we often
						get too lazy to get up, let's at least stretch out our upper
						bodies.🤗
					</Typography>
					<Button
						variant="contained"
						name="begin"
						disabled={beginClicked}
						onClick={buttonClick}
					>
						Begin
					</Button>
					<Button
						variant="contained"
						name="reset"
						disabled={!beginClicked}
						onClick={buttonClick}
					>
						Reset
					</Button>
					{tooClose && (
						<Alert severity="error">
							You're too close! Please step back a little so that we can see
							your elbows too.💪🏻
						</Alert>
					)}
					<Stack p={2} sx={{ height: 480 }}>
						<Webcam ref={webcamRef} width={640} height={480} />
						<canvas ref={canvasRef} width={640} height={480} />
					</Stack>
					{!stretchComplete ? (
						<div>
							{beginClicked ? (
								<Typography variant="h6" color="text.primary">
									Pose: {poseEmojis[currentPose]}
								</Typography>
							) : (
								<Typography variant="h6" color="text.primary">
									Press Begin!
								</Typography>
							)}
							<Typography color="text.secondary">
								Left: {displayTime(poseTimes.LEFT)}, Up:{" "}
								{displayTime(poseTimes["UP"])}, Right:{" "}
								{displayTime(poseTimes["RIGHT"])}
							</Typography>
						</div>
					) : (
						<Typography variant="h5" color="text.primary">
							🎉Stretch Complete!🎉
						</Typography>
					)}
				</Container>
			</Box>
		</div>
	);
};

export default Stretch;
