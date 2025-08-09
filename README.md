# Ygri CRM

A modern CRM application for tracking client projects through visual stage-by-stage workflows.

## Features

- **Authentication**: Secure login with email/password, sign-up, and magic link options
- **Project Management**: Visual mind-map workflow for tracking project stages
- **Stage Management**: Detailed stage view with todos, comments, and file attachments
- **Client Tracking**: Comprehensive client and project overview
- **Real-time Updates**: Live updates across the application
- **Responsive Design**: Modern UI with Tailwind-style utility classes

## Tech Stack

- **Frontend**: React 18 + Vite
- **Routing**: React Router DOM v7+
- **Visualization**: React Flow for mind-map workflows  
- **Backend**: Supabase (PostgreSQL, Auth, Storage, RLS)
- **Styling**: Custom CSS utility classes (Tailwind-compatible)

## Database Schema

The application uses a comprehensive Supabase schema including:

- **Users & Profiles**: User management with roles (owner/staff)
- **Clients**: Company information and contact details
- **Workflow Templates**: Service and Product workflow definitions
- **Tracks**: Individual projects with stage progression
- **Stage Management**: Todos, comments, files, and activity tracking
- **Security**: Row Level Security (RLS) policies throughout

## Getting Started

1. **Clone the repository**
   ```bash
   git clone git@github.com:davidk2yoyo/Ygri.git
   cd Ygri
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Add your Supabase credentials:
   ```
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:5173`

## Project Structure

```
src/
├── pages/
│   ├── LoginPage.jsx      # Authentication page
│   ├── ProjectsPage.jsx   # Main CRM dashboard with mind-map
│   ├── ClientsPage.jsx    # Client management (placeholder)
│   ├── FilesPage.jsx      # File management (placeholder)
│   └── SettingsPage.jsx   # Application settings (placeholder)
├── Layout.jsx             # Main layout with navigation
├── ProtectedRoute.jsx     # Authentication guard component
├── StageDrawer.jsx        # Stage details sidebar
├── supabaseClient.js      # Supabase configuration
├── main.jsx              # App entry point with routing
└── index.css             # Utility CSS classes
```

## Authentication Flow

1. **Unauthenticated users** → Redirected to `/login`
2. **Successful login** → Redirected to `/projects` 
3. **Sign out** → Session cleared, redirected to `/login`
4. **Protected routes** → Only accessible with valid session

## Navigation

- **Projects**: Main CRM dashboard with visual workflows
- **Clients**: Client management interface
- **Files**: File and document management
- **Settings**: Application preferences and configuration

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production  
- `npm run preview` - Preview production build

### Database Functions

The app uses several Supabase RPC functions:
- `get_track_detail()` - Fetch complete track information
- `get_stage_detail()` - Fetch stage with todos/comments/files
- `complete_stage_and_advance()` - Progress stages
- `add_stage_comment()` - Add comments to stages
- `add_stage_todo()` - Create stage todos
- `update_stage_todo()` - Update todo completion

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is private and proprietary.