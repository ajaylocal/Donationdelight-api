import { initializeSuperAdmin } from '../utils/setupSuperAdmin'
import connectDB from '../config/db.config'

async function main() {
  try {
    // Connect to database
    await connectDB()

    // Initialize superadmin with your desired credentials
    const result = await initializeSuperAdmin(
      'superadmin@zipzap.com', // Email
      'SuperAdmin123!', // Password
      'Super', // First name
      'Admin' // Last name
    )

    console.log('✅ Superadmin setup completed successfully!')
    console.log('Role ID:', result.role._id)
    console.log('User ID:', result.user._id)
    console.log('Email:', result.user.email)
    console.log('Username:', result.user.username)

    process.exit(0)
  } catch (error) {
    console.error('❌ Error setting up superadmin:', error)
    process.exit(1)
  }
}

main()
