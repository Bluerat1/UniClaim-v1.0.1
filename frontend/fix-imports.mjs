import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define the base directory (frontend/src)
const baseDir = path.join(__dirname, 'src');

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

// Get all TypeScript and JavaScript files
function getFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const file of files) {
    const filePath = path.join(dir, file.name);
    
    if (file.isDirectory()) {
      // Skip node_modules, .next, and other non-source directories
      if (['node_modules', '.next', '.git', 'dist', 'build', 'coverage'].includes(file.name)) {
        continue;
      }
      getFiles(filePath, fileList);
    } else if (/\.(js|jsx|ts|tsx)$/.test(file.name)) {
      fileList.push(filePath);
    }
  }
  
  return fileList;
}

// Process all files
const files = getFiles(baseDir);
let updatedFiles = 0;

console.log(`Found ${files.length} files to process...`);

for (let i = 0; i < files.length; i++) {
  const file = files[i];
  try {
    let content = fs.readFileSync(file, 'utf8');
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
          regex: new RegExp(`(require\(['\"])${oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(['\"]\))`, 'g'),
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
      fs.writeFileSync(file, content, 'utf8');
      updatedFiles++;
      console.log(`Updated imports in ${path.relative(process.cwd(), file)}`);
    }
    
    // Show progress
    if ((i + 1) % 10 === 0 || i === files.length - 1) {
      console.log(`Processed ${i + 1} of ${files.length} files...`);
    }
  } catch (error) {
    console.error(`Error processing ${file}:`, error);
  }
}

console.log(`\nUpdate complete! Updated ${updatedFiles} out of ${files.length} files.`);
