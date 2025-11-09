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
  console.log(req);

  const { schema } = req.body;
  const userId = req.user.userId; // from auth middleware

  const mainDbConnection = await getMainDb();

  const userDbConnection = await getUserDb(req.token);
  if (!userDbConnection) {
    console.log("User not found in cached backend map");
    return res.status(401).json({ error: 'Connection timed out' });
  }

  // Save schema to user DB
  await userDbConnection.collection("settings").updateOne(
    { schemaType: "jobCard" },
    { $set: { schema, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
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

  if (!userDbConnection) {
    console.log("User not found in cached backend map");
    return res.status(401).json({ error: 'Connection timed out' });
  }

  // Fetch schema from user DB
  const config = await userDbConnection.collection("settings").findOne({ schemaType: "jobCard" });

  if (!config) {
    return res.status(204).json({ error: 'Configuration not found' });
  }

  res.status(200).json(config);
});

router.get("/jobs/count", authenticateAndGetUserDb, async (req, res) => {
  try {
    const userDbConnection = await getUserDb(req.token);
    if (!userDbConnection) {
      console.log("User not found in cached backend map");
      return res.status(401).json({ error: 'Connection timed out' });
    }

    const total = await userDbConnection.collection("jobs").countDocuments({});
    console.log("Total jobs count:", total);
    return res.status(200).json({ total });
  } catch (err) {
    console.error("Error getting job count:", err);
    res.status(500).json({ error: "Failed to get job count" });
  }
});

router.get("/jobs/getjobcards", authenticateAndGetUserDb, async (req, res) => {
  try {
    const userDb = getUserDb(req.token);
    if (!userDb) {
      return res.status(500).json({ error: "User DB not found" });
    }

    // Pagination params
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 20;
    if (page < 1) page = 1;

    const skip = (page - 1) * limit;

    // Fetch jobs sorted by latest first
    const jobs = await userDb
      .collection("jobs")
      .find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Check if more jobs exist
    const total = await userDb.collection("jobs").countDocuments();
    const hasMore = skip + jobs.length < total;

    res.json({
      jobs,
      page,
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
      .find({})
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
  customer_name
) => {
  // Only run if we have both pieces of data
  if (customer_phone && customer_name) {
    try {
      await customersDataCollection.updateOne(
        { customer_phone: customer_phone },
        { $set: { customer_name: customer_name } },
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
      const userDbConnection = await getUserDb(req.token);
      if (!userDbConnection) {
        console.log("User not found in cached backend map");
        return res.status(401).json({ error: "Connection timed out" });
      }

      const jobsCollection = userDbConnection.collection("jobs");
      const customersDataCollection = userDbConnection.collection("customer_phones");

      const newJob = req.body;

      // Generate job number
      const lastJob = await jobsCollection.findOne({}, { sort: { job_no: -1 } });
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
        newJob.customer_name
      );

    } catch (err) {
      console.error("Error saving job:", err);
      res.status(500).json({ success: false, message: "Failed to save job" });
    }
  });

router.get("/jobs/getjobcard/:id", authenticateAndGetUserDb, async (req, res) => {
  try {
    const userDbConnection = await getUserDb(req.token);
    if (!userDbConnection) return res.status(401).json({ error: "Connection timed out" });

    const jobsCollection = userDbConnection.collection("jobs");
    const job = await jobsCollection.findOne({ _id: new ObjectId(req.params.id) });

    if (!job) return res.status(404).json({ error: "Job not found" });

    res.json({ job });
  } catch (err) {
    console.error("Error fetching job:", err);
    res.status(500).json({ error: "Failed to fetch job" });
  }
});

router.put("/jobs/updatejobcard/:id", authenticateAndGetUserDb, async (req, res) => {
  try {
    const userDbConnection = await getUserDb(req.token);
    if (!userDbConnection)
      return res.status(401).json({ error: "Connection timed out" });

    const jobsCollection = userDbConnection.collection("jobs");
    const customersDataCollection =
      userDbConnection.collection("customer_phones"); // 👈 Get collection

    const { _id, job_no, ...updates } = req.body; // prevent changing job_no

    const result = await jobsCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
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
      updates.customer_name
    );

  } catch (err) {
    console.error("Error updating job:", err);
    res.status(500).json({ error: "Failed to update job" });
  }
}
);

router.get("/whatsapp/get-messages", authenticateAndGetUserDb, async (req, res) => {
  try {
    const userDbConnection = await getUserDb(req.token);
    if (!userDbConnection)
      return res.status(401).json({ error: "Connection timed out" });

    const messages = await userDbConnection
      .collection("whatsapp_messages")
      .find({})
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
    const userDbConnection = await getUserDb(req.token);
    if (!userDbConnection) return res.status(401).json({ error: "Connection timed out" });

    const { name, text } = req.body;

    if (!name || !text) {
      return res.status(400).json({ error: "Name and text are required." });
    }

    // const db = await getMainDb();
    await userDbConnection.collection("whatsapp_messages").insertOne({
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
        { _id: new ObjectId(id) },
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
    const userDbConnection = await getUserDb(req.token);
    if (!userDbConnection)
      return res.status(401).json({ error: "Connection timed out" });

    const { id } = req.params;

    const result = await userDbConnection
      .collection("whatsapp_messages")
      .deleteOne({ _id: new ObjectId(id) });

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
    const userDb = await getUserDb(req.token);
    if (!userDb) return res.status(401).json({ error: "Connection timed out" });
    const customers = await userDb
      .collection("customer_phones")
      .find({})
      .toArray();
    res.json({ success: true, customers });
  } catch (err) {
    console.error("Error fetching customers:", err);
    res.status(500).json({ success: false, message: "Failed to load customers" });
  }
});

router.delete("/customerdetails/:id", authenticateAndGetUserDb, async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Validate the ID format before proceeding
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid ID format" });
    }

    // 2. Get the user-specific database
    const userDb = await getUserDb(req.token);
    if (!userDb) return res.status(401).json({ error: "Connection timed out" });
    const deleteId = new ObjectId(id);

    // 3. Perform the delete operation
    const result = await userDb.collection("customer_phones").deleteOne({ _id: deleteId });

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
    const userDb = await getUserDb(req.token);
    if (!userDb) return res.status(401).json({ error: "Connection timed out" });
    const items = await userDb.collection("items").find({}).toArray();
    res.json({ success: true, items });
  } catch (err) {
    console.error("Error fetching items:", err);
    res.status(500).json({ success: false, message: "Failed to load items" });
  }
});

router.post("/items", authenticateAndGetUserDb, async (req, res) => {
  try {
    const { item_name } = req.body;
    if (!item_name) {
      return res.status(400).json({ success: false, message: "Item name is required" });
    }

    const userDb = await getUserDb(req.token);
    if (!userDb) return res.status(401).json({ error: "Connection timed out" });
    const newItem = { item_name: item_name.trim() };

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
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid ID format" });
    }

    const userDb = await getUserDb(req.token);
    if (!userDb) return res.status(401).json({ error: "Connection timed out" });
    const result = await userDb.collection("items").deleteOne({ _id: new ObjectId(id) });

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
    const userDb = await getUserDb(req.token);
    if (!userDb) return res.status(401).json({ error: "Connection timed out" });
    const parts = await userDb.collection("parts").find({}).sort({ part_name: 1 }).toArray();
    res.json({ success: true, parts });
  } catch (err) {
    console.error("Error fetching parts:", err);
    res.status(500).json({ success: false, message: "Failed to load parts" });
  }
});

router.post("/parts", authenticateAndGetUserDb, async (req, res) => {
  try {
    const { part_name, part_price } = req.body;
    if (!part_name) {
      return res.status(400).json({ success: false, message: "Part name is required" });
    }
    if (part_price === undefined || part_price === null || isNaN(parseFloat(part_price))) {
      return res.status(400).json({ success: false, message: "A valid part price is required" });
    }

    const userDb = await getUserDb(req.token);
    if (!userDb) return res.status(401).json({ error: "Connection timed out" });

    const existingPart = await userDb.collection("parts").findOne({ part_name });
    if (existingPart) {
      return res.status(400).json({ success: false, message: "A part with this name already exists" });
    }

    const newPart = {
      part_name,
      part_price: parseFloat(part_price),
    };

    const result = await userDb.collection("parts").insertOne(newPart);

    const insertedPart = await userDb.collection("parts").findOne({ _id: result.insertedId });

    res.status(201).json({ success: true, message: "Part added successfully", part: insertedPart });
  } catch (err) {
    console.error("Error adding part:", err);
    res.status(500).json({ success: false, message: "Failed to add part" });
  }
});

router.put("/parts/:id", authenticateAndGetUserDb, async (req, res) => {
  try {
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

    const existingPart = await userDb.collection("parts").findOne({
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

    const result = await userDb.collection("parts").updateOne(
      { _id: new ObjectId(id) },
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
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid part ID" });
    }

    const userDb = await getUserDb(req.token);
    const result = await userDb.collection("parts").deleteOne({ _id: new ObjectId(id) });

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
