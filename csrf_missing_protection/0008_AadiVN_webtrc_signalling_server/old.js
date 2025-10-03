const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const { Observable } = require("rxjs");
const isEqual = require("lodash/isEqual");
const { type } = require("os");

class SignallingServer {
  constructor(port) {
    this.app = express();
    this.port = port || 3000;

    // Maps to store iceCandidates, answers, and offers keyed by user ID
    this.iceCandidatesMap = new Map();
    this.answerMap = new Map(); // Maps for answers
    this.offerMap = new Map(); // Maps for offers

    // Server setup
    this.server = http.createServer(this.app);
    this.wss = new WebSocket.Server({ server: this.server });

    // WebSocket subscriptions
    this.iceCandidatesSubscriptions = new Map();
    this.answerSubscriptions = new Map();
    this.offerSubscriptions = new Map();

    this.setupRoutes();
    this.setupWebSocket();
  }

  setupRoutes() {
    const app = this.app;

    // Middleware to parse JSON body
    app.use(express.json());

    // Endpoint to add an ICE candidate
    app.post("/add-iceCandidate", (req, res) => {
      const { userId, candidate, sdpMid, sdpMLineIndex } = req.body;
      if (!this.iceCandidatesMap.has(userId)) {
        this.iceCandidatesMap.set(userId, []);
      }
      const userCandidates = this.iceCandidatesMap.get(userId);
      userCandidates.push({ candidate, sdpMid, sdpMLineIndex });
      console.log("ICE candidate added for user:", userId, {
        candidate,
        sdpMid,
        sdpMLineIndex,
      });
      res.send(
        `Ice candidate added for user ${userId}: ${JSON.stringify({
          candidate,
          sdpMid,
          sdpMLineIndex,
        })}`
      );
    });

    // Endpoint to set the answer variable
    app.post("/set-answer", (req, res) => {
      const { userId, sdp, type } = req.body;
      this.answerMap.set(userId, { sdp: sdp, tpye: type });
      console.log("Answer set for user:", userId, "to:", {
        sdp: sdp,
        tpye: type,
      });
      res.send(
        `Answer set for user ${userId} to: ${JSON.stringify({
          sdp: sdp,
          tpye: type,
        })}`
      );
    });

    // Endpoint to set the offer variable
    app.post("/set-offer", (req, res) => {
      const { userId, sdp, type } = req.body;
      this.offerMap.set(userId, { sdp: sdp, tpye: type });
      console.log("Offer set for user:", userId, "to:", {
        sdp: sdp,
        tpye: type,
      });
      res.send(
        `Offer set for user ${userId} to: ${JSON.stringify({
          sdp: sdp,
          tpye: type,
        })}`
      );
    });

    // Endpoint to check if a room exists for a user ID
    app.post("/roomexists", (req, res) => {
      const { userId } = req.body;
      const offerExists = this.offerMap.has(userId);
      console.log(
        "Room exists check for user:",
        userId,
        "result:",
        offerExists
      );
      res.json({ exists: offerExists });
    });

    // Default route
    app.get("/", (req, res) => {
      console.log("Default route accessed");
      res.send("Welcome to the server");
    });

    // Endpoint to delete user data (iceCandidates, answer, offer) for a given userId
    app.delete("/hangup", (req, res) => {
      const { userId } = req.body;

      // Remove data from iceCandidatesMap
      this.iceCandidatesMap.delete(userId);
      console.log("Cleared ICE candidates for user:", userId);

      // Remove data from answerMap
      this.answerMap.delete(userId);
      console.log("Cleared answer for user:", userId);

      // Remove data from offerMap
      this.offerMap.delete(userId);
      console.log("Cleared offer for user:", userId);

      res.send(`Cleared data for user ${userId}`);
    });
  }

  setupWebSocket() {
    this.wss.on("connection", (ws, req) => {
      console.log("New WebSocket connection established");

      ws.on("message", (message) => {
        const parsedMessage = JSON.parse(message);
        const { type, userId } = parsedMessage;

        if (type === "subscribe") {
          const { streamType } = parsedMessage;

          if (streamType === "iceCandidates") {
            this.subscribeToIceCandidates(userId, ws);
          } else if (streamType === "answer") {
            this.subscribeToAnswer(userId, ws);
          } else if (streamType === "offer") {
            this.subscribeToOffer(userId, ws);
          }
        }
      });

      ws.on("close", () => {
        console.log("WebSocket connection closed");
      });

      ws.on("error", (error) => {
        console.error("WebSocket error:", error);
      });
    });
  }

  subscribeToIceCandidates(userId, ws) {
    const subscription = this.createIceCandidatesChangeStream(userId).subscribe(
      {
        next: (newCandidate) => {
          ws.send(JSON.stringify({ type: "iceCandidate", data: newCandidate }));
          console.log("ICE candidate sent to client:", newCandidate);
        },
        error: (err) => {
          console.error("Error:", err);
        },
        complete: () => {
          console.log("ICE candidate subscription completed for user:", userId);
        },
      }
    );

    this.iceCandidatesSubscriptions.set(subscription, userId);
    console.log("ICE candidate subscription created for user:", userId);

    ws.on("close", () => {
      subscription.unsubscribe();
      this.iceCandidatesSubscriptions.delete(subscription);
      console.log("ICE candidate subscription closed for user:", userId);
    });
  }

  subscribeToAnswer(userId, ws) {
    const subscription = this.createAnswerChangeStream(userId).subscribe({
      next: (newAnswer) => {
        ws.send(JSON.stringify({ type: "answer", data: newAnswer }));
        console.log("Answer sent to client:", newAnswer);
      },
      error: (err) => {
        console.error("Error:", err);
      },
      complete: () => {
        console.log("Answer subscription completed for user:", userId);
      },
    });

    this.answerSubscriptions.set(subscription, userId);
    console.log("Answer subscription created for user:", userId);

    ws.on("close", () => {
      subscription.unsubscribe();
      this.answerSubscriptions.delete(subscription);
      console.log("Answer subscription closed for user:", userId);
    });
  }

  subscribeToOffer(userId, ws) {
    const subscription = this.createOfferChangeStream(userId).subscribe({
      next: (newOffer) => {
        ws.send(JSON.stringify({ type: "offer", data: newOffer }));
        console.log("Offer sent to client:", newOffer);
      },
      error: (err) => {
        console.error("Error:", err);
      },
      complete: () => {
        console.log("Offer subscription completed for user:", userId);
      },
    });

    this.offerSubscriptions.set(subscription, userId);
    console.log("Offer subscription created for user:", userId);

    ws.on("close", () => {
      subscription.unsubscribe();
      this.offerSubscriptions.delete(subscription);
      console.log("Offer subscription closed for user:", userId);
    });
  }

  createIceCandidatesChangeStream(userId) {
    let currentArray = this.iceCandidatesMap.get(userId) || [];
    let lastCandidate =
      currentArray.length > 0 ? currentArray[currentArray.length - 1] : null;

    return new Observable((subscriber) => {
      const checkArrayChange = () => {
        const newArray = this.iceCandidatesMap.get(userId) || [];
        if (newArray.length > currentArray.length) {
          const newCandidate = newArray[newArray.length - 1];
          if (!isEqual(newCandidate, lastCandidate)) {
            lastCandidate = newCandidate;
            subscriber.next(newCandidate); // Emit only the new candidate
            console.log("New ICE candidate emitted:", newCandidate);
          }
        }
        currentArray = [...newArray];
      };

      const intervalId = setInterval(checkArrayChange, 100); // Check for changes periodically

      return () => clearInterval(intervalId);
    });
  }

  createAnswerChangeStream(userId) {
    let currentAnswer = this.answerMap.get(userId) || "";

    return new Observable((subscriber) => {
      const checkAnswerChange = () => {
        const newAnswer = this.answerMap.get(userId) || "";
        if (!isEqual(newAnswer, currentAnswer)) {
          currentAnswer = newAnswer;
          subscriber.next(currentAnswer); // Emit the new answer
          console.log(
            "New answer emitted for user:",
            userId,
            "answer:",
            newAnswer
          );
        }
      };

      const intervalId = setInterval(checkAnswerChange, 100); // Check for changes periodically

      return () => clearInterval(intervalId);
    });
  }

  createOfferChangeStream(userId) {
    let currentOffer = this.offerMap.get(userId) || "";

    return new Observable((subscriber) => {
      const checkOfferChange = () => {
        const newOffer = this.offerMap.get(userId) || "";
        if (!isEqual(newOffer, currentOffer)) {
          currentOffer = newOffer;
          subscriber.next(currentOffer); // Emit the new offer
          console.log(
            "New offer emitted for user:",
            userId,
            "offer:",
            newOffer
          );
        }
      };

      const intervalId = setInterval(checkOfferChange, 100); // Check for changes periodically

      return () => clearInterval(intervalId);
    });
  }

  start() {
    this.server.listen(this.port, () => {
      console.log(`Signalling Server running at http://localhost:${this.port}`);
    });
  }
}

// Create an instance of SignallingServer and start listening
const signallingServer = new SignallingServer(3000);
console.log("Signalling server instance created on port 3000");
signallingServer.start();
