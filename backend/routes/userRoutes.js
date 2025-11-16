// routes/userRoutes.js
const express = require('express');
const authenticateAndGetUserDb = require('../middleware/authMiddleware')
const checkSubscription = require('../middleware/checkValidityMiddleware');
const { getUserDb } = require('../config/userDb');
const { getMainDb } = require('../config/mainDb');
const { ObjectId } = require("mongodb");

const router = express.Router();

// Protected route example
router.get('/my-data', authenticateAndGetUserDb, async (req, res) => {
  try {
    // Example: you can use req.userDb to query user's own DB
    // const items = await req.userDb.collection('items').find({}).toArray();

    res.status(200).json({ name: "Hetvik Test Dashboard page" });
  } catch (error) {
    console.error('Error in /my-data route:', error);
    res.status(500).json({ error: 'Server error while fetching data.' });
  }
});

// POST /save-config
router.post("/save-config", authenticateAndGetUserDb, async (req, res) => {
  // console.log(req);

  const { schema } = req.body;
  const userId = req.user.userId; // from auth middleware

  const mainDbConnection = await getMainDb();

  // Assuming this returns the Shared App Database connection
  const userDbConnection = await getUserDb(req.token);

  if (!userDbConnection) {
    console.log("User not found in cached backend map");
    return res.status(401).json({ error: 'Connection timed out' });
  }

  // Save schema to user DB (Shared Collection)
  await userDbConnection.collection("settings").updateOne(
    // 1. FILTER: Look for document that matches BOTH the user ID and the type
    { uid: userId, schemaType: "jobCard" },
    {
      $set: { schema, updatedAt: new Date() },
      // 2. INSERT: If creating a new doc, ensure 'uid' is added
      $setOnInsert: { createdAt: new Date(), uid: userId }
    },
    { upsert: true }
  );

  // Mark schemaConfigured = true in main DB
  await mainDbConnection.collection("users").updateOne(
    { _id: new ObjectId(userId) },
    { $set: { schemaConfigured: true } }
  );

  res.status(200).json({ message: "Configuration saved successfully!" });
});

router.get("/get-config", authenticateAndGetUserDb, async (req, res) => {
  const userId = req.user.userId; // from auth middleware

  const userDbConnection = await getUserDb(req.token);

  if (!userDbConnection) {
    console.log("User not found in cached backend map");
    return res.status(401).json({ error: 'Connection timed out' });
  }

  // Fetch schema from user DB (Scoped by UID)
  const config = await userDbConnection.collection("settings").findOne({
    uid: userId, // <--- Added this check
    schemaType: "jobCard"
  });

  if (!config) {
    return res.status(204).json({ error: 'Configuration not found' });
  }

  res.status(200).json(config);
});

router.get("/jobs/count", authenticateAndGetUserDb, async (req, res) => {
  try {
    const userId = req.user.userId; // from auth middleware

    const userDbConnection = await getUserDb(req.token);
    if (!userDbConnection) {
      console.log("User not found in cached backend map");
      return res.status(401).json({ error: 'Connection timed out' });
    }

    // Count documents ONLY for this user
    const total = await userDbConnection.collection("jobs").countDocuments({ uid: userId });

    console.log("Total jobs count:", total);
    return res.status(200).json({ total });
  } catch (err) {
    console.error("Error getting job count:", err);
    res.status(500).json({ error: "Failed to get job count" });
  }
});

router.get("/jobs/getjobcards", authenticateAndGetUserDb, async (req, res) => {
  try {
    const userId = req.user.userId; // from auth middleware

    // Assuming getUserDb is synchronous or returns a promise. 
    // If it's async, you need 'await'. Based on your previous snippets, it seems async.
    const userDb = await getUserDb(req.token);

    if (!userDb) {
      return res.status(500).json({ error: "User DB not found" });
    }

    // Pagination params
    let page = parseInt(req.query.page) || 1; // if page comes as 0 or undefined, default to 1 logic or handle offset directly
    // But based on your frontend logic (offset based), let's stick to offset/limit or fix page calculation
    // Frontend sends offset & limit directly? Or page?
    // Code snippet says: req.query.offset and req.query.limit usually for skipping.

    // Let's look at your code: you use 'skip' variable.
    // If frontend sends 'offset', use that directly as 'skip'.
    // If frontend sends 'page', calculate skip.

    // Standardizing based on your provided snippet logic:
    let limit = parseInt(req.query.limit) || 20;
    let offset = parseInt(req.query.offset) || 0; // If using offset directly

    // Fetch jobs sorted by latest first, scoped by UID
    const jobs = await userDb
      .collection("jobs")
      .find({ uid: userId }) // <--- Added UID check
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    // Check total count scoped by UID
    const total = await userDb.collection("jobs").countDocuments({ uid: userId }); // <--- Added UID check

    const hasMore = offset + jobs.length < total;

    res.json({
      jobs,
      offset,
      limit,
      total,
      hasMore,
    });
  } catch (err) {
    console.error("Error fetching jobs:", err);
    res.status(500).json({ error: "Server error while fetching jobs" });
  }
});

router.get("/jobs/list", authenticateAndGetUserDb, async (req, res) => {
  try {
    const userId = req.user.userId; // from auth middleware

    const userDbConnection = await getUserDb(req.token);
    if (!userDbConnection) {
      console.log("User not found in cached backend map");
      return res.status(401).json({ error: 'Connection timed out' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const jobs = await userDbConnection
      .collection("jobs")
      .find({ uid: userId }) // <--- Added UID check here
      .skip(skip)
      .limit(limit)
      .toArray();

    res.json({ jobs });
  } catch (err) {
    console.error("Error getting jobs list:", err);
    res.status(500).json({ error: "Failed to get jobs list" });
  }
});

const upsertCustomerInBackground = async (
  customersDataCollection,
  customer_phone,
  customer_name,
  userId // <--- ADDED: Need user ID to scope the customer
) => {
  // Only run if we have both pieces of data
  if (customer_phone && customer_name) {
    try {
      await customersDataCollection.updateOne(
        // 1. FILTER: Find customer by phone AND user ID
        { uid: userId, customer_phone: customer_phone },
        {
          $set: { customer_name: customer_name },
          // 2. INSERT: Ensure 'uid' is set on creation
          $setOnInsert: { uid: userId }
        },
        { upsert: true }
      );
      // Optional: Log success if needed
      // console.log(`Async customer save success for: ${customer_phone}`);
    } catch (err) {
      // We must catch errors here, otherwise it's an unhandled promise rejection
      console.error(
        `Async customer save/update failed for ${customer_phone}:`,
        err
      );
    }
  }
};

router.post("/jobs/savejobcard",
  authenticateAndGetUserDb,
  checkSubscription,
  async (req, res) => {
    try {
      const userId = req.user.userId; // from auth middleware
      const userDbConnection = await getUserDb(req.token);

      if (!userDbConnection) {
        console.log("User not found in cached backend map");
        return res.status(401).json({ error: "Connection timed out" });
      }

      const jobsCollection = userDbConnection.collection("jobs");
      const customersDataCollection = userDbConnection.collection("customer_phones");

      const newJob = req.body;
      newJob.uid = userId; // <--- 1. ADD UID TO THE JOB

      // Generate job number (Scoped by UID)
      const lastJob = await jobsCollection.findOne(
        { uid: userId }, // <--- 2. FIND LAST JOB FOR THIS USER ONLY
        { sort: { job_no: -1 } }
      );
      const nextJobNo = lastJob ? lastJob.job_no + 1 : 1;

      newJob.job_no = nextJobNo;
      newJob.createdAt = new Date();

      // Save jobcard first (main operation)
      await jobsCollection.insertOne(newJob);

      // Send response immediately (non-blocking)
      res.json({
        success: true,
        message: "Job saved successfully",
        job_no: nextJobNo,
      });

      // 🔄 Call the new non-blocking function
      upsertCustomerInBackground(
        customersDataCollection,
        newJob.customer_phone,
        newJob.customer_name,
        userId // <--- 3. PASS USER ID HERE
      );

    } catch (err) {
      console.error("Error saving job:", err);
      res.status(500).json({ success: false, message: "Failed to save job" });
    }
  });

router.get("/jobs/getjobcard/:id", authenticateAndGetUserDb, async (req, res) => {
  try {
    const userId = req.user.userId; // from auth middleware
    const userDbConnection = await getUserDb(req.token);

    if (!userDbConnection) return res.status(401).json({ error: "Connection timed out" });

    const jobsCollection = userDbConnection.collection("jobs");

    // Find job by ID AND User ID (Security Check)
    const job = await jobsCollection.findOne({
      _id: new ObjectId(req.params.id),
      uid: userId // <--- Critical: Only find if it belongs to this user
    });

    if (!job) return res.status(404).json({ error: "Job not found" });

    res.json({ job });
  } catch (err) {
    console.error("Error fetching job:", err);
    res.status(500).json({ error: "Failed to fetch job" });
  }
});

router.put("/jobs/updatejobcard/:id", authenticateAndGetUserDb, async (req, res) => {
  try {
    const userId = req.user.userId; // from auth middleware
    const userDbConnection = await getUserDb(req.token);

    if (!userDbConnection)
      return res.status(401).json({ error: "Connection timed out" });

    const jobsCollection = userDbConnection.collection("jobs");
    const customersDataCollection = userDbConnection.collection("customer_phones");

    const { _id, job_no, ...updates } = req.body; // prevent changing job_no or _id

    const result = await jobsCollection.updateOne(
      {
        _id: new ObjectId(req.params.id),
        uid: userId // <--- CRITICAL: Ensure user owns this job
      },
      { $set: updates }
    );

    if (result.matchedCount === 0)
      return res.status(404).json({ error: "Job not found" });

    // Send response immediately
    res.json({ success: true, message: "Job updated successfully" });

    // 🔄 Call the new non-blocking function
    upsertCustomerInBackground(
      customersDataCollection,
      updates.customer_phone,
      updates.customer_name,
      userId // <--- Pass userId here so the customer is saved to the correct user account
    );

  } catch (err) {
    console.error("Error updating job:", err);
    res.status(500).json({ error: "Failed to update job" });
  }
});

router.get("/whatsapp/get-messages", authenticateAndGetUserDb, async (req, res) => {
  try {
    const userId = req.user.userId; // from auth middleware
    const userDbConnection = await getUserDb(req.token);

    if (!userDbConnection)
      return res.status(401).json({ error: "Connection timed out" });

    const messages = await userDbConnection
      .collection("whatsapp_messages")
      .find({ uid: userId }) // <--- Added UID check
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json(messages);
  } catch (err) {
    console.error("Error fetching WhatsApp messages:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

router.post("/whatsapp/create-message", authenticateAndGetUserDb, async (req, res) => {
  try {
    const userId = req.user.userId; // from auth middleware
    const userDbConnection = await getUserDb(req.token);

    if (!userDbConnection) return res.status(401).json({ error: "Connection timed out" });

    const { name, text } = req.body;

    if (!name || !text) {
      return res.status(400).json({ error: "Name and text are required." });
    }

    await userDbConnection.collection("whatsapp_messages").insertOne({
      uid: userId, // <--- ADDED: Scope this message to the user
      name,
      text,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    res.status(201).json({
      message: "Message created successfully",
      data: { name, text },
    });
  } catch (err) {
    console.error("Error creating WhatsApp message:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

router.put("/whatsapp/update-message/:id", authenticateAndGetUserDb, async (req, res) => {
  try {
    const userId = req.user.userId; // from auth middleware
    const userDbConnection = await getUserDb(req.token);

    if (!userDbConnection)
      return res.status(401).json({ error: "Connection timed out" });

    const { id } = req.params;
    const { name, text } = req.body;

    if (!name || !text)
      return res.status(400).json({ error: "Name and text are required." });

    const result = await userDbConnection
      .collection("whatsapp_messages")
      .updateOne(
        // Filter by ID *AND* User ID
        { _id: new ObjectId(id), uid: userId },
        { $set: { name, text, updatedAt: new Date() } }
      );

    if (result.matchedCount === 0)
      return res.status(404).json({ error: "Message not found." });

    res.status(200).json({ message: "Message updated successfully." });
  } catch (err) {
    console.error("Error updating WhatsApp message:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

router.delete("/whatsapp/delete-message/:id", authenticateAndGetUserDb, async (req, res) => {
  try {
    const userId = req.user.userId; // from auth middleware
    const userDbConnection = await getUserDb(req.token);

    if (!userDbConnection)
      return res.status(401).json({ error: "Connection timed out" });

    const { id } = req.params;

    const result = await userDbConnection
      .collection("whatsapp_messages")
      .deleteOne({
        _id: new ObjectId(id),
        uid: userId // <--- CRITICAL: Only delete if user owns it
      });

    if (result.deletedCount === 0)
      return res.status(404).json({ error: "Message not found." });

    res.status(200).json({ message: "Message deleted successfully." });
  } catch (err) {
    console.error("Error deleting WhatsApp message:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

router.get("/customerdetails", authenticateAndGetUserDb, async (req, res) => {
  try {
    const userId = req.user.userId; // from auth middleware
    const userDb = await getUserDb(req.token);

    if (!userDb) return res.status(401).json({ error: "Connection timed out" });

    const customers = await userDb
      .collection("customer_phones")
      .find({ uid: userId }) // <--- Critical: Filter by User ID
      .toArray();

    res.json({ success: true, customers });
  } catch (err) {
    console.error("Error fetching customers:", err);
    res.status(500).json({ success: false, message: "Failed to load customers" });
  }
});

router.delete("/customerdetails/:id", authenticateAndGetUserDb, async (req, res) => {
  try {
    const userId = req.user.userId; // from auth middleware
    const { id } = req.params;

    // 1. Validate the ID format before proceeding
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid ID format" });
    }

    // 2. Get the user-specific database
    const userDb = await getUserDb(req.token);
    if (!userDb) return res.status(401).json({ error: "Connection timed out" });

    const deleteId = new ObjectId(id);

    // 3. Perform the delete operation (Scoped by UID)
    const result = await userDb.collection("customer_phones").deleteOne({
      _id: deleteId,
      uid: userId // <--- Critical: Only delete if user owns this customer
    });

    // 4. Check if a document was actually deleted
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    // 5. Send success response
    res.status(200).json({ success: true, message: "Customer deleted successfully" });

  } catch (err) {
    console.error("Error deleting customer:", err);
    res.status(500).json({ success: false, message: "Failed to delete customer" });
  }
});

router.get("/items", authenticateAndGetUserDb, async (req, res) => {
  try {
    const userId = req.user.userId; // from auth middleware
    const userDb = await getUserDb(req.token);

    if (!userDb) return res.status(401).json({ error: "Connection timed out" });

    const items = await userDb.collection("items")
      .find({ uid: userId }) // <--- Critical: Filter by User ID
      .toArray();

    res.json({ success: true, items });
  } catch (err) {
    console.error("Error fetching items:", err);
    res.status(500).json({ success: false, message: "Failed to load items" });
  }
});

router.post("/items", authenticateAndGetUserDb, async (req, res) => {
  try {
    const userId = req.user.userId; // from auth middleware
    const { item_name } = req.body;

    if (!item_name) {
      return res.status(400).json({ success: false, message: "Item name is required" });
    }

    const userDb = await getUserDb(req.token);
    if (!userDb) return res.status(401).json({ error: "Connection timed out" });

    const newItem = {
      uid: userId, // <--- Critical: Tag item with User ID
      item_name: item_name.trim()
    };

    // Insert the new document
    const result = await userDb.collection("items").insertOne(newItem);

    // Create the object to return to the frontend, including the new _id
    const insertedItem = { _id: result.insertedId, ...newItem };

    res.status(201).json({ success: true, message: "Item added", item: insertedItem });

  } catch (err) {
    console.error("Error adding item:", err);
    res.status(500).json({ success: false, message: "Failed to add item" });
  }
});

router.delete("/items/:id", authenticateAndGetUserDb, async (req, res) => {
  try {
    const userId = req.user.userId; // from auth middleware
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid ID format" });
    }

    const userDb = await getUserDb(req.token);
    if (!userDb) return res.status(401).json({ error: "Connection timed out" });

    // Delete ONLY if _id matches AND uid matches the logged-in user
    const result = await userDb.collection("items").deleteOne({
      _id: new ObjectId(id),
      uid: userId // <--- Critical: Security check
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "Item not found" });
    }

    res.status(200).json({ success: true, message: "Item deleted" });

  } catch (err) {
    console.error("Error deleting item:", err);
    res.status(500).json({ success: false, message: "Failed to delete item" });
  }
});

router.get("/parts", authenticateAndGetUserDb, async (req, res) => {
  try {
    const userId = req.user.userId; // from auth middleware
    const userDb = await getUserDb(req.token);

    if (!userDb) return res.status(401).json({ error: "Connection timed out" });

    const parts = await userDb.collection("parts")
      .find({ uid: userId }) // <--- Critical: Filter by User ID
      .sort({ part_name: 1 })
      .toArray();

    res.json({ success: true, parts });
  } catch (err) {
    console.error("Error fetching parts:", err);
    res.status(500).json({ success: false, message: "Failed to load parts" });
  }
});

router.post("/parts", authenticateAndGetUserDb, async (req, res) => {
  try {
    const userId = req.user.userId; // from auth middleware
    const { part_name, part_price } = req.body;

    if (!part_name) {
      return res.status(400).json({ success: false, message: "Part name is required" });
    }
    if (part_price === undefined || part_price === null || isNaN(parseFloat(part_price))) {
      return res.status(400).json({ success: false, message: "A valid part price is required" });
    }

    const userDb = await getUserDb(req.token);
    if (!userDb) return res.status(401).json({ error: "Connection timed out" });

    // Check for duplicate ONLY within this user's data
    const existingPart = await userDb.collection("parts").findOne({
      uid: userId,
      part_name: part_name
    });

    if (existingPart) {
      return res.status(400).json({ success: false, message: "A part with this name already exists" });
    }

    const newPart = {
      uid: userId, // <--- Critical: Tag with User ID
      part_name,
      part_price: parseFloat(part_price),
    };

    const result = await userDb.collection("parts").insertOne(newPart);

    // Retrieve the complete inserted document to return to frontend
    const insertedPart = await userDb.collection("parts").findOne({ _id: result.insertedId });

    res.status(201).json({ success: true, message: "Part added successfully", part: insertedPart });
  } catch (err) {
    console.error("Error adding part:", err);
    res.status(500).json({ success: false, message: "Failed to add part" });
  }
});

router.put("/parts/:id", authenticateAndGetUserDb, async (req, res) => {
  try {
    const userId = req.user.userId; // from auth middleware
    const { id } = req.params;
    const { part_name, part_price } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid part ID" });
    }

    if (!part_name) {
      return res.status(400).json({ success: false, message: "Part name is required" });
    }
    if (part_price === undefined || part_price === null || isNaN(parseFloat(part_price))) {
      return res.status(400).json({ success: false, message: "A valid part price is required" });
    }

    const userDb = await getUserDb(req.token);
    if (!userDb) return res.status(401).json({ error: "Connection timed out" });

    // 1. Check for duplicate name ONLY within this user's data
    const existingPart = await userDb.collection("parts").findOne({
      uid: userId, // <--- Critical: Scope check to this user
      part_name,
      _id: { $ne: new ObjectId(id) }
    });

    if (existingPart) {
      return res.status(400).json({ success: false, message: "Another part with this name already exists" });
    }

    const updateData = {
      $set: {
        part_name,
        part_price: parseFloat(part_price)
      }
    };

    // 2. Update ONLY if ID matches AND it belongs to this user
    const result = await userDb.collection("parts").updateOne(
      {
        _id: new ObjectId(id),
        uid: userId // <--- Critical: Security check
      },
      updateData
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: "Part not found" });
    }

    const updatedPart = await userDb.collection("parts").findOne({ _id: new ObjectId(id) });

    res.json({ success: true, message: "Part updated successfully", part: updatedPart });
  } catch (err) {
    console.error("Error updating part:", err);
    res.status(500).json({ success: false, message: "Failed to update part" });
  }
});

router.delete("/parts/:id", authenticateAndGetUserDb, async (req, res) => {
  try {
    const userId = req.user.userId; // from auth middleware
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid part ID" });
    }

    const userDb = await getUserDb(req.token);

    // Delete ONLY if _id matches AND uid matches the logged-in user
    const result = await userDb.collection("parts").deleteOne({
      _id: new ObjectId(id),
      uid: userId // <--- Critical: Security check
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "Part not found" });
    }

    res.status(200).json({ success: true, message: "Part deleted successfully" });
  } catch (err) {
    console.error("Error deleting part:", err);
    res.status(500).json({ success: false, message: "Failed to delete part" });
  }
});

module.exports = router;
