import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// List of files that need import fixes
const filesToFix = [
  // User routes
  'src/routes/user-routes/AboutUniClaim.tsx',
  'src/routes/user-routes/Contact.tsx',
  'src/routes/user-routes/HomePage.tsx',
  'src/routes/user-routes/Login.tsx',
  'src/routes/user-routes/MessagesPage.tsx',
  'src/routes/user-routes/MyTicket.tsx',
  'src/routes/user-routes/Profile.tsx',
  'src/routes/user-routes/Register.tsx',
  'src/routes/user-routes/ResetPassword.tsx',
  'src/routes/user-routes/ReportPage.tsx',
  'src/routes/user-routes/LocationReport.tsx',
  
  // Admin routes
  'src/routes/admin-routes/AdminLogin.tsx',
  'src/routes/admin-routes/UnclaimedPostsPage.tsx',
  
  // Other files
  'src/App.tsx',
  'src/PageRoutes.tsx'
];

// Component mappings with old and new paths
const componentMappings = {
  // Admin components
  '@/components/AdminCampusSecurityTurnoverModal': '@/components/admin/AdminCampusSecurityTurnoverModal',
  '@/components/AdminChatWindow': '@/components/admin/AdminChatWindow',
  '@/components/AdminConversationList': '@/components/admin/AdminConversationList',
  '@/components/AdminPostCard': '@/components/admin/AdminPostCard',
  '@/components/AdminPostCardList': '@/components/admin/AdminPostCardList',
  '@/components/AdminPostModal': '@/components/admin/AdminPostModal',
  '@/components/AdminRoute': '@/components/admin/AdminRoute',
  '@/components/AdminUnclaimedPostModal': '@/components/admin/AdminUnclaimedPostModal',
  '@/components/ConversationCleanupAdmin': '@/components/admin/ConversationCleanup',
  
  // Chat components
  '@/components/ChatWindow': '@/components/chat/ChatWindow',
  '@/components/ConversationList': '@/components/chat/ConversationList',
  '@/components/MessageBubble': '@/components/chat/MessageBubble',
  '@/components/FixConversation': '@/components/chat/FixConversation',
  '@/components/GhostConversationCleanup': '@/components/chat/GhostConversationCleanup',
  
  // Form components
  '@/components/GeneralInputComp': '@/components/forms/Input',
  '@/components/InputField': '@/components/forms/InputField',
  '@/components/InputFieldComp': '@/components/forms/InputFieldComp',
  '@/components/InputFieldwEyeComp': '@/components/forms/InputFieldWithEye',
  '@/components/ItemInfoForm': '@/components/forms/ItemInfoForm',
  '@/components/DropdownWithSearch': '@/components/forms/DropdownWithSearch',
  
  // Layout components
  '@/components/NavHeadComp': '@/components/layout/NavHead',
  '@/components/PageWrapper': '@/components/layout/PageWrapper',
  '@/components/LoadingSpinner': '@/components/layout/LoadingSpinner',
  '@/components/ErrorBoundary': '@/components/layout/ErrorBoundary',
  
  // Modal components
  '@/components/ActivationModal': '@/components/modals/Activation',
  '@/components/ClaimVerificationModal': '@/components/modals/ClaimVerification',
  '@/components/FlagModal': '@/components/modals/Flag',
  '@/components/FoundActionModal': '@/components/modals/FoundAction',
  '@/components/HandoverVerificationModal': '@/components/modals/HandoverVerification',
  '@/components/ImageModal': '@/components/modals/Image',
  '@/components/ImageModalDemo': '@/components/modals/ImageDemo',
  '@/components/PostModal': '@/components/modals/Post',
  '@/components/TurnoverConfirmationModal': '@/components/modals/TurnoverConfirmation',
  '@/components/CampusSecurityTurnoverModal': '@/components/modals/CampusSecurityTurnover',
  '@/components/OSATurnoverModal': '@/components/modals/OSATurnover',
  '@/components/TicketModal': '@/components/modals/Ticket',
  
  // Post components
  '@/components/PostCard': '@/components/posts/Card',
  '@/components/PostCardMenu': '@/components/posts/CardMenu',
  '@/components/FlagButton': '@/components/posts/FlagButton',
  
  // User components
  '@/components/ProfilePicture': '@/components/user/ProfilePicture',
  '@/components/ProfilePictureSeenIndicator': '@/components/user/ProfilePictureSeenIndicator',
  '@/components/NotificationPreferences': '@/components/user/NotificationPreferences',
  
  // Auth components
  '@/components/EmailVerificationRoute': '@/components/auth/EmailVerificationRoute',
  '@/components/ProtectedRoute': '@/components/auth/ProtectedRoute',
  
  // Common components
  '@/components/ItemCategory': '@/components/common/ItemCategory',
  '@/components/LocationMap': '@/components/common/LocationMap',
  '@/components/MultiControlPanel': '@/components/common/MultiControlPanel',
  '@/components/SearchBar': '@/components/common/SearchBar',
  '@/components/ToastComp': '@/components/common/Toast',
  '@/components/ToastFormHelper': '@/components/common/ToastFormHelper',
  '@/components/ToastItem': '@/components/common/ToastItem',
  '@/components/Tooltip': '@/components/common/Tooltip',
  '@/components/ClaimDetailsDisplay': '@/components/common/ClaimDetailsDisplay',
  '@/components/HandoverDetailsDisplay': '@/components/common/HandoverDetailsDisplay',
  '@/components/Filters': '@/components/common/Filters',
  '@/components/MobileFilter': '@/components/common/MobileFilter',
  '@/components/ImagePicker': '@/components/common/ImagePicker',
  '@/components/TicketCard': '@/components/common/TicketCard',
  '@/components/USTPCDOMap': '@/components/common/USTPCDOMap',
};

// Add relative path mappings
Object.entries(componentMappings).forEach(([oldPath, newPath]) => {
  const relativeOldPath = oldPath.replace('@/components/', '../../components/');
  const relativeNewPath = newPath.replace('@/components/', '../../components/');
  if (relativeOldPath !== oldPath) {
    componentMappings[relativeOldPath] = relativeNewPath;
  }
});

// Add non-@ paths
Object.entries(componentMappings).forEach(([oldPath, newPath]) => {
  const nonAtOldPath = oldPath.replace('@', '');
  const nonAtNewPath = newPath.replace('@', '');
  if (nonAtOldPath !== oldPath) {
    componentMappings[nonAtOldPath] = nonAtNewPath;
  }
});

// Process files
let updatedFiles = 0;

async function processFiles() {
  for (const filePath of filesToFix) {
    const fullPath = path.join(process.cwd(), filePath);
    
    if (!fs.existsSync(fullPath)) {
      console.log(`File not found: ${fullPath}`);
      continue;
    }
    
    try {
      let content = await fs.promises.readFile(fullPath, 'utf8');
      const originalContent = content;
      
      // Update each import pattern
      for (const [oldPath, newPath] of Object.entries(componentMappings)) {
        // Create regex patterns for different import styles
        const patterns = [
          // import X from 'path'
          { 
            regex: new RegExp(`(import\s+[\\w*{}\s,]+\s+from\s+['\"])${oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(['\"])`, 'g'),
            replacement: `$1${newPath}$2`
          },
          // require('path')
          { 
            regex: new RegExp(`(require\(['\"])${oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(['\"]\\)`, 'g'),
            replacement: `$1${newPath}$2`
          },
          // import 'path'
          { 
            regex: new RegExp(`(import\s+['\"])${oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(['\"])`, 'g'),
            replacement: `$1${newPath}$2`
          }
        ];
        
        for (const { regex, replacement } of patterns) {
          content = content.replace(regex, replacement);
        }
      }
      
      // Save the file if changes were made
      if (content !== originalContent) {
        await fs.promises.writeFile(fullPath, content, 'utf8');
        updatedFiles++;
        console.log(`Updated imports in ${filePath}`);
      }
    } catch (error) {
      console.error(`Error processing ${filePath}:`, error);
    }
  }
  
  console.log(`\nUpdate complete! Updated ${updatedFiles} out of ${filesToFix.length} files.`);
}

processFiles().catch(console.error);
