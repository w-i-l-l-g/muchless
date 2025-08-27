const { MongoClient, ObjectId } = require('mongodb');

let db = null;

async function connectToDatabase() {
  if (db) {
    console.log('Using existing database connection');
    return db;
  }
  
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/kindlenotes';
    console.log('Connecting to MongoDB at:', mongoUri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@'));
    
    const client = new MongoClient(mongoUri, {
      // Keep options minimal and compatible across driver versions.
      // TLS, auth, retryWrites, and writeConcern should come from the URI (e.g., mongodb+srv Atlas string).
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 60000,
      connectTimeoutMS: 30000,
      maxPoolSize: 10
    });
    
    console.log('Attempting to connect to MongoDB...');
    await client.connect();
    console.log('MongoDB client connected, pinging server...');
    
    // Test the connection
    const pingResult = await client.db().command({ ping: 1 });
    console.log('MongoDB ping result:', pingResult);
    
    db = client.db();
    console.log('Successfully connected to database:', db.databaseName);
    
    // Log the database stats
    try {
      const stats = await db.stats();
      console.log('Database stats:', {
        collections: stats.collections,
        objects: stats.objects,
        dataSize: stats.dataSize,
        storageSize: stats.storageSize,
        indexSize: stats.indexSize
      });
    } catch (statsError) {
      console.warn('Could not get database stats:', statsError.message);
    }
    
    return db;
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    throw new Error(`Database connection failed: ${error.message}`);
  }
}

async function saveUser(username, email) {
  try {
    console.log('Attempting to save user:', username, email);
    const db = await connectToDatabase();
    const users = db.collection('users');
    
    // Create lowercase versions for case-insensitive lookups
    const username_lc = username.toLowerCase();
    const email_lc = email.toLowerCase();
    
    // Check if user already exists - using the lowercase username for comparison
    const existingUser = await users.findOne({ username_lc });
    console.log('Existing user check:', existingUser ? 'User exists' : 'No existing user');
    
    if (existingUser) {
      return { success: false, message: 'User already exists' };
    }
    
    // Create new user with both original and lowercase fields
    const userData = {
      username,
      username_lc,
      email,
      email_lc,
      createdAt: new Date(),
      notes: []
    };
    
    console.log('Inserting new user:', userData);
    const result = await users.insertOne(userData);
    console.log('User insert result:', result);
    
    // Verify user was created
    const newUser = await users.findOne({ _id: result.insertedId });
    console.log('Retrieved new user from DB:', newUser);
    
    return { success: true, userId: result.insertedId };
  } catch (error) {
    console.error('Error saving user to database:', error);
    return { success: false, message: 'Database error' };
  }
}

async function createNote(username, noteName) {
  try {
    console.log('Creating note for user:', username, 'with name:', noteName);
    const db = await connectToDatabase();
    
    // Get references to both collections
    const users = db.collection('users');
    const notes = db.collection('notes');
    
    // Check if user exists first - using lowercase username for lookup
    const username_lc = username.toLowerCase();
    const user = await users.findOne({ username_lc });
    console.log('User lookup result:', user ? 'User found' : 'User not found');
    
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    
    console.log('Creating note in separate collection');
    // Create note with userId reference but no username_lc duplication
    const note = {
      _id: new ObjectId(),
      userId: user._id,
      username: username, // Keep original username for simpler queries
      name: noteName,
      content: '',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Insert the note into the notes collection
    const result = await notes.insertOne(note);
    console.log('Note insert result:', result);
    
    if (!result.insertedId) {
      return { success: false, message: 'Failed to create note' };
    }
    
    return { 
      success: true, 
      note: {
        id: note._id,
        name: note.name,
        createdAt: note.createdAt
      }
    };
  } catch (error) {
    console.error('Error creating note:', error);
    return { success: false, message: 'Error creating note' };
  }
}

async function getUserNotes(username) {
  try {
    const db = await connectToDatabase();
    const notes = db.collection('notes');
    
    // Use the original username for notes lookup since notes still use the original username
    // This will need to be updated if we update all notes to also use username_lc
    const userNotes = await notes.find(
      { username },
      { 
        sort: { createdAt: -1 },
        projection: { _id: 1, name: 1, createdAt: 1, updatedAt: 1 }
      }
    ).toArray();
    
    return { success: true, notes: userNotes };
  } catch (error) {
    console.error('Error getting user notes:', error);
    return { success: false, message: 'Error retrieving notes' };
  }
}

async function updateNote(username, noteId, content) {
  try {
    console.log('Updating note:', noteId, 'for user:', username);
    const db = await connectToDatabase();
    const notes = db.collection('notes');
    
    // Update the note content and updatedAt timestamp
    // Still using original username for notes lookup until we update note creation
    const result = await notes.updateOne(
      { 
        _id: new ObjectId(noteId), 
        username: username 
      },
      { 
        $set: { 
          content: content,
          updatedAt: new Date()
        }
      }
    );
    
    if (result.matchedCount === 0) {
      return { success: false, message: 'Note not found or access denied' };
    }
    
    if (result.modifiedCount === 0) {
      return { success: true, message: 'Note content unchanged' };
    }
    
    return { success: true, message: 'Note updated successfully' };
  } catch (error) {
    console.error('Error updating note:', error);
    return { success: false, message: 'Error updating note' };
  }
}

async function checkUserExists(username) {
  try {
    const db = await connectToDatabase();
    const users = db.collection('users');
    
    // Convert input to lowercase for case-insensitive comparison
    const username_lc = username.toLowerCase();
    
    // Check if user exists using lowercase username
    const user = await users.findOne({ username_lc });
    
    return { 
      success: true, 
      exists: !!user,
      username: user ? user.username : null // Return original username if found
    };
  } catch (error) {
    console.error('Error checking user existence:', error);
    return { success: false, message: 'Database error' };
  }
}

/**
 * Letter data type functions
 */

async function createLetter(fromUsername, toUsername, content, status = 'draft') {
  try {
    const db = await connectToDatabase();
    const letters = db.collection('letters');
    
    // Get user IDs
    const users = db.collection('users');
    const fromUser = await users.findOne({ username_lc: fromUsername.toLowerCase() });
    const toUser = await users.findOne({ username_lc: toUsername.toLowerCase() });
    
    if (!fromUser || !toUser) {
      return { success: false, message: 'One or both users not found' };
    }
    
    const letter = {
      _id: new ObjectId(),
      fromUserId: fromUser._id,
      fromUsername: fromUser.username,
      toUserId: toUser._id,
      toUsername: toUser.username,
      content,
      status, // draft, queued, delivered
      createdAt: new Date(),
      updatedAt: new Date(),
      sentAt: null,
      deliveredAt: null
    };
    
    const result = await letters.insertOne(letter);
    return { success: true, letterId: letter._id };
  } catch (error) {
    console.error('Error creating letter:', error);
    return { success: false, message: 'Database error' };
  }
}

async function getLettersByStatus(username, status) {
  try {
    const db = await connectToDatabase();
    const letters = db.collection('letters');
    
    const query = status === 'received' 
      ? { toUsername: username, status: 'delivered' } 
      : { fromUsername: username, status };
    
    const results = await letters.find(query).toArray();
    return { success: true, letters: results };
  } catch (error) {
    console.error(`Error getting ${status} letters:`, error);
    return { success: false, message: 'Database error' };
  }
}

async function getLetter(letterId, username) {
  try {
    const db = await connectToDatabase();
    const letters = db.collection('letters');
    
    const letter = await letters.findOne({ _id: new ObjectId(letterId) });
    
    if (!letter) {
      return { success: false, message: 'Letter not found' };
    }
    
    // Access control - user must be sender or recipient
    if (letter.fromUsername !== username && letter.toUsername !== username) {
      return { success: false, message: 'Access denied' };
    }
    
    return { success: true, letter };
  } catch (error) {
    console.error('Error getting letter:', error);
    return { success: false, message: 'Database error' };
  }
}

async function updateLetter(letterId, username, updates) {
  try {
    const db = await connectToDatabase();
    const letters = db.collection('letters');
    
    // Verify the letter exists and belongs to this user
    const letter = await letters.findOne({
      _id: new ObjectId(letterId),
      fromUsername: username,
      status: 'draft' // Can only update drafts
    });
    
    if (!letter) {
      return { success: false, message: 'Letter not found or cannot be updated' };
    }
    
    // Apply updates
    const updateFields = { ...updates, updatedAt: new Date() };
    
    const result = await letters.updateOne(
      { _id: new ObjectId(letterId) },
      { $set: updateFields }
    );
    
    return { success: true, modified: result.modifiedCount > 0 };
  } catch (error) {
    console.error('Error updating letter:', error);
    return { success: false, message: 'Database error' };
  }
}

async function deleteLetter(letterId, username) {
  try {
    const db = await connectToDatabase();
    const letters = db.collection('letters');
    
    // Verify the letter exists and belongs to this user
    const letter = await letters.findOne({
      _id: new ObjectId(letterId),
      fromUsername: username,
      status: 'draft' // Can only delete drafts
    });
    
    if (!letter) {
      return { success: false, message: 'Letter not found or cannot be deleted' };
    }
    
    const result = await letters.deleteOne({ _id: new ObjectId(letterId) });
    
    return { success: true, deleted: result.deletedCount > 0 };
  } catch (error) {
    console.error('Error deleting letter:', error);
    return { success: false, message: 'Database error' };
  }
}

module.exports = {
  connectToDatabase,
  saveUser,
  createNote,
  getUserNotes,
  updateNote,
  checkUserExists,
  
  // Letter functions
  createLetter,
  getLettersByStatus,
  getLetter,
  updateLetter,
  deleteLetter,
  // Add index for faster lookups
  async createIndexes() {
    try {
      const db = await connectToDatabase();
      await db.collection('users').createIndex({ username_lc: 1 }, { unique: true });
      await db.collection('users').createIndex({ email_lc: 1 });
      await db.collection('notes').createIndex({ username: 1 });
      await db.collection('notes').createIndex({ userId: 1 });
      
      // Letter indexes
      await db.collection('letters').createIndex({ fromUsername: 1 });
      await db.collection('letters').createIndex({ toUsername: 1 });
      await db.collection('letters').createIndex({ status: 1 });
      console.log('Database indexes created');
    } catch (error) {
      console.error('Error creating indexes:', error);
    }
  }
};
