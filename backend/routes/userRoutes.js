const express = require('express');
// 👇 CHANGE: Middleware now attaches req.db
const authenticateAndAttachDb = require('../middleware/authMiddleware.js');
const checkSubscription = require('../middleware/checkValidityMiddleware.js');
const { ObjectId } = require("mongodb");

const router = express.Router();

router.get('/my-data', authenticateAndAttachDb, async (req, res) => {
  try {
    // Example: you can use req.db to query user's own data
    // const items = await req.db.collection('items').find({ uid: req.user.userId }).toArray();

    res.status(200).json({ name: "Hetvik Test Dashboard page" });
  } catch (error) {
    console.error('Error in /my-data route:', error);
    res.status(500).json({ error: 'Server error while fetching data.' });
  }
});

router.post("/save-config", authenticateAndAttachDb, async (req, res) => {
  try {
    const { schema } = req.body;
    const userId = req.user.userId;

    // Save schema to 'settings' collection (Scoped by UID)
    await req.db.collection("settings").updateOne(
      { uid: userId, schemaType: "jobCard" },
      {
        $set: { schema, updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date(), uid: userId }
      },
      { upsert: true }
    );

    await req.db.collection("users").updateOne(
      { _id: new ObjectId(userId) },
      { $set: { schemaConfigured: true } }
    );

    res.status(200).json({ message: "Configuration saved successfully!" });
  } catch (err) {
    console.error("Error saving config:", err);
    res.status(500).json({ error: "Failed to save configuration" });
  }
});

router.get("/get-config", authenticateAndAttachDb, async (req, res) => {
  try {
    const userId = req.user.userId;

    const config = await req.db.collection("settings").findOne({
      uid: userId,
      schemaType: "jobCard"
    });

    if (!config) {
      return res.status(204).json({ error: 'Configuration not found' });
    }

    res.status(200).json(config);
  } catch (err) {
    console.error("Error getting config:", err);
    res.status(500).json({ error: "Failed to get configuration" });
  }
});


router.get("/jobs/count", authenticateAndAttachDb, async (req, res) => {
  try {
    const userId = req.user.userId;

    const total = await req.db.collection("jobs").countDocuments({ uid: userId });

    // console.log("Total jobs count:", total);
    return res.status(200).json({ total });
  } catch (err) {
    console.error("Error getting job count:", err);
    res.status(500).json({ error: "Failed to get job count" });
  }
});

router.get("/jobs/getjobcards", authenticateAndAttachDb, async (req, res) => {
  try {
    const userId = req.user.userId;

    let limit = parseInt(req.query.limit) || 20;
    let offset = parseInt(req.query.offset) || 0;

    const jobs = await req.db
      .collection("jobs")
      .find({ uid: userId })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    const total = await req.db.collection("jobs").countDocuments({ uid: userId });

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

router.get("/jobs/list", authenticateAndAttachDb, async (req, res) => {
  try {
    const userId = req.user.userId;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const jobs = await req.db
      .collection("jobs")
      .find({ uid: userId })
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
  dbInstance,
  customer_phone,
  customer_name,
  userId
) => {
  if (customer_phone && customer_name) {
    try {
      await dbInstance.collection("customer_phones").updateOne(
        { uid: userId, customer_phone: customer_phone },
        {
          $set: { customer_name: customer_name },
          $setOnInsert: { uid: userId }
        },
        { upsert: true }
      );
    } catch (err) {
      console.error(`Async customer save failed for ${customer_phone}:`, err);
    }
  }
};

router.post("/jobs/savejobcard",
  authenticateAndAttachDb,
  checkSubscription,
  async (req, res) => {
    try {
      const userId = req.user.userId;
      const jobsCollection = req.db.collection("jobs");

      const newJob = req.body;
      newJob.uid = userId;

      const lastJob = await jobsCollection.findOne(
        { uid: userId },
        { sort: { job_no: -1 } }
      );
      const nextJobNo = lastJob ? lastJob.job_no + 1 : 1;

      newJob.job_no = nextJobNo;
      newJob.createdAt = new Date();

      await jobsCollection.insertOne(newJob);

      res.json({
        success: true,
        message: "Job saved successfully",
        job_no: nextJobNo,
      });

      upsertCustomerInBackground(
        req.db,
        newJob.customer_phone,
        newJob.customer_name,
        userId
      );

    } catch (err) {
      console.error("Error saving job:", err);
      res.status(500).json({ success: false, message: "Failed to save job" });
    }
  });

router.get("/jobs/getjobcard/:id", authenticateAndAttachDb, async (req, res) => {
  try {
    const userId = req.user.userId;

    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid Job ID" });
    }

    const job = await req.db.collection("jobs").findOne({
      _id: new ObjectId(req.params.id),
      uid: userId
    });

    if (!job) return res.status(404).json({ error: "Job not found" });

    res.json({ job });
  } catch (err) {
    console.error("Error fetching job:", err);
    res.status(500).json({ error: "Failed to fetch job" });
  }
});

router.put("/jobs/updatejobcard/:id", authenticateAndAttachDb, async (req, res) => {
  try {
    const userId = req.user.userId;

    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid Job ID" });
    }

    const { _id, job_no, ...updates } = req.body;

    const result = await req.db.collection("jobs").updateOne(
      {
        _id: new ObjectId(req.params.id),
        uid: userId
      },
      { $set: updates }
    );

    if (result.matchedCount === 0)
      return res.status(404).json({ error: "Job not found" });

    res.json({ success: true, message: "Job updated successfully" });

    upsertCustomerInBackground(
      req.db,
      updates.customer_phone,
      updates.customer_name,
      userId
    );

  } catch (err) {
    console.error("Error updating job:", err);
    res.status(500).json({ error: "Failed to update job" });
  }
});

router.get("/whatsapp/get-messages", authenticateAndAttachDb, async (req, res) => {
  try {
    const userId = req.user.userId;

    const messages = await req.db
      .collection("whatsapp_messages")
      .find({ uid: userId })
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json(messages);
  } catch (err) {
    console.error("Error fetching WhatsApp messages:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

router.post("/whatsapp/create-message", authenticateAndAttachDb, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, text } = req.body;

    if (!name || !text) {
      return res.status(400).json({ error: "Name and text are required." });
    }

    await req.db.collection("whatsapp_messages").insertOne({
      uid: userId,
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

router.put("/whatsapp/update-message/:id", authenticateAndAttachDb, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { name, text } = req.body;

    if (!name || !text)
      return res.status(400).json({ error: "Name and text are required." });

    const result = await req.db
      .collection("whatsapp_messages")
      .updateOne(
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

router.delete("/whatsapp/delete-message/:id", authenticateAndAttachDb, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const result = await req.db
      .collection("whatsapp_messages")
      .deleteOne({
        _id: new ObjectId(id),
        uid: userId
      });

    if (result.deletedCount === 0)
      return res.status(404).json({ error: "Message not found." });

    res.status(200).json({ message: "Message deleted successfully." });
  } catch (err) {
    console.error("Error deleting WhatsApp message:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

router.get("/customerdetails", authenticateAndAttachDb, async (req, res) => {
  try {
    const userId = req.user.userId;

    const customers = await req.db
      .collection("customer_phones")
      .find({ uid: userId })
      .toArray();

    res.json({ success: true, customers });
  } catch (err) {
    console.error("Error fetching customers:", err);
    res.status(500).json({ success: false, message: "Failed to load customers" });
  }
});

router.delete("/customerdetails/:id", authenticateAndAttachDb, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid ID format" });
    }

    const result = await req.db.collection("customer_phones").deleteOne({
      _id: new ObjectId(id),
      uid: userId
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    res.status(200).json({ success: true, message: "Customer deleted successfully" });

  } catch (err) {
    console.error("Error deleting customer:", err);
    res.status(500).json({ success: false, message: "Failed to delete customer" });
  }
});

router.get("/items", authenticateAndAttachDb, async (req, res) => {
  try {
    const userId = req.user.userId;

    const items = await req.db.collection("items")
      .find({ uid: userId })
      .toArray();

    res.json({ success: true, items });
  } catch (err) {
    console.error("Error fetching items:", err);
    res.status(500).json({ success: false, message: "Failed to load items" });
  }
});

router.post("/items", authenticateAndAttachDb, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { item_name } = req.body;

    if (!item_name) {
      return res.status(400).json({ success: false, message: "Item name is required" });
    }

    const newItem = {
      uid: userId,
      item_name: item_name.trim()
    };

    const result = await req.db.collection("items").insertOne(newItem);
    const insertedItem = { _id: result.insertedId, ...newItem };

    res.status(201).json({ success: true, message: "Item added", item: insertedItem });

  } catch (err) {
    console.error("Error adding item:", err);
    res.status(500).json({ success: false, message: "Failed to add item" });
  }
});

router.delete("/items/:id", authenticateAndAttachDb, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid ID format" });
    }

    const result = await req.db.collection("items").deleteOne({
      _id: new ObjectId(id),
      uid: userId
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

router.get("/parts", authenticateAndAttachDb, async (req, res) => {
  try {
    const userId = req.user.userId;

    const parts = await req.db.collection("parts")
      .find({ uid: userId })
      .sort({ part_name: 1 })
      .toArray();

    res.json({ success: true, parts });
  } catch (err) {
    console.error("Error fetching parts:", err);
    res.status(500).json({ success: false, message: "Failed to load parts" });
  }
});

router.post("/parts", authenticateAndAttachDb, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { part_name, part_price } = req.body;

    if (!part_name) {
      return res.status(400).json({ success: false, message: "Part name is required" });
    }
    if (part_price === undefined || part_price === null || isNaN(parseFloat(part_price))) {
      return res.status(400).json({ success: false, message: "A valid part price is required" });
    }

    const existingPart = await req.db.collection("parts").findOne({
      uid: userId,
      part_name: part_name
    });

    if (existingPart) {
      return res.status(400).json({ success: false, message: "A part with this name already exists" });
    }

    const newPart = {
      uid: userId,
      part_name,
      part_price: parseFloat(part_price),
    };

    const result = await req.db.collection("parts").insertOne(newPart);
    const insertedPart = await req.db.collection("parts").findOne({ _id: result.insertedId });

    res.status(201).json({ success: true, message: "Part added successfully", part: insertedPart });
  } catch (err) {
    console.error("Error adding part:", err);
    res.status(500).json({ success: false, message: "Failed to add part" });
  }
});

router.put("/parts/:id", authenticateAndAttachDb, async (req, res) => {
  try {
    const userId = req.user.userId;
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

    const existingPart = await req.db.collection("parts").findOne({
      uid: userId,
      part_name,
      _id: { $ne: new ObjectId(id) }
    });

    if (existingPart) {
      return res.status(400).json({ success: false, message: "Another part with this name already exists" });
    }

    const result = await req.db.collection("parts").updateOne(
      { _id: new ObjectId(id), uid: userId },
      { $set: { part_name, part_price: parseFloat(part_price) } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: "Part not found" });
    }

    const updatedPart = await req.db.collection("parts").findOne({ _id: new ObjectId(id) });

    res.json({ success: true, message: "Part updated successfully", part: updatedPart });
  } catch (err) {
    console.error("Error updating part:", err);
    res.status(500).json({ success: false, message: "Failed to update part" });
  }
});

router.delete("/parts/:id", authenticateAndAttachDb, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid part ID" });
    }

    const result = await req.db.collection("parts").deleteOne({
      _id: new ObjectId(id),
      uid: userId
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