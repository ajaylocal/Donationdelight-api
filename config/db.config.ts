import * as mongoose from 'mongoose'

const DB = async () => {
  try {
    const mongoUri = Bun.env.MONGO_URI
    if (!mongoUri) {
      throw new Error('Missing MONGO_URI in environment variables')
    }

    const conn = await mongoose.connect(mongoUri, {
      autoIndex: true,
    })

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`)
  } catch (err: any) {
    console.error(`❌ MongoDB Connection Error: ${err.message}`)
    process.exit(1) // Exit on failure
  }
}

export default DB
