import { useState } from 'react';
import { ghostConversationService } from '@/services/firebase/conversations';

interface GhostConversation {
  conversationId: string;
  postId: string;
  reason: string;
}

interface OrphanedMessage {
  conversationId: string;
  messageId: string;
  reason: string;
}

interface CleanupResult {
  success: number;
  failed: number;
  errors: string[];
}

export default function GhostConversationCleanup() {
  const [ghostConversations, setGhostConversations] = useState<GhostConversation[]>([]);
  const [orphanedMessages, setOrphanedMessages] = useState<OrphanedMessage[]>([]);
  const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [integrityResult, setIntegrityResult] = useState<any>(null);

  const detectGhosts = async () => {
    try {
      setLoading(true);
      console.log('🔍 Starting ghost conversation detection...');
      
      const ghosts = await ghostConversationService.detectGhostConversations();
      setGhostConversations(ghosts);
      
      if (ghosts.length > 0) {
        console.log(`🔍 Found ${ghosts.length} ghost conversations:`, ghosts);
      } else {
        console.log('✅ No ghost conversations found!');
      }
    } catch (error: any) {
      console.error('❌ Ghost detection failed:', error);
      alert(`Ghost detection failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const detectOrphanedMessages = async () => {
    try {
      setLoading(true);
      console.log('🔍 Starting orphaned message detection...');
      
      const orphans = await ghostConversationService.detectOrphanedMessages();
      setOrphanedMessages(orphans);
      
      if (orphans.length > 0) {
        console.log(`🔍 Found ${orphans.length} orphaned messages:`, orphans);
      } else {
        console.log('✅ No orphaned messages found!');
      }
    } catch (error: any) {
      console.error('❌ Orphaned message detection failed:', error);
      alert(`Orphaned message detection failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const cleanupGhosts = async () => {
    if (ghostConversations.length === 0) {
      alert('No ghost conversations to clean up!');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${ghostConversations.length} ghost conversations? This action cannot be undone.`)) {
      return;
    }

    try {
      setLoading(true);
      console.log('🧹 Starting ghost conversation cleanup...');
      
      const result = await ghostConversationService.cleanupGhostConversations(ghostConversations);
      setCleanupResult(result);
      
      if (result.success > 0) {
        console.log(`✅ Successfully cleaned up ${result.success} ghost conversations`);
        // Refresh the ghost list
        await detectGhosts();
      }
      
      if (result.failed > 0) {
        console.warn(`⚠️ Failed to clean up ${result.failed} conversations`);
      }
    } catch (error: any) {
      console.error('❌ Ghost cleanup failed:', error);
      alert(`Ghost cleanup failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const cleanupOrphanedMessages = async () => {
    if (orphanedMessages.length === 0) {
      alert('No orphaned messages to clean up!');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${orphanedMessages.length} orphaned messages? This action cannot be undone.`)) {
      return;
    }

    try {
      setLoading(true);
      console.log('🧹 Starting orphaned message cleanup...');
      
      const result = await ghostConversationService.cleanupOrphanedMessages(orphanedMessages);
      setCleanupResult(result);
      
      if (result.success > 0) {
        console.log(`✅ Successfully cleaned up ${result.success} orphaned messages`);
        // Refresh the orphaned message list
        await detectOrphanedMessages();
      }
      
      if (result.failed > 0) {
        console.warn(`⚠️ Failed to clean up ${result.failed} messages`);
      }
    } catch (error: any) {
      console.error('❌ Orphaned message cleanup failed:', error);
      alert(`Orphaned message cleanup failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const validateIntegrity = async () => {
    try {
      setLoading(true);
      console.log('🔍 Starting conversation integrity validation...');
      
      const result = await ghostConversationService.validateConversationIntegrity();
      setIntegrityResult(result);
      
      console.log('🔍 Integrity validation complete:', result);
    } catch (error: any) {
      console.error('❌ Integrity validation failed:', error);
      alert(`Integrity validation failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Ghost Conversation & Message Cleanup Tool</h2>
      
      <div className="space-y-6">
        {/* Ghost Conversation Detection Section */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-3 text-gray-700">1. Detect Ghost Conversations</h3>
          <p className="text-sm text-gray-600 mb-4">
            Scan for conversations that reference posts that no longer exist.
          </p>
          <button
            onClick={detectGhosts}
            disabled={loading}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Detecting...' : 'Detect Ghost Conversations'}
          </button>
          
          {ghostConversations.length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium text-gray-700 mb-2">
                Found {ghostConversations.length} Ghost Conversation(s):
              </h4>
              <div className="bg-red-50 border border-red-200 rounded p-3 max-h-60 overflow-y-auto">
                {ghostConversations.map((ghost, index) => (
                  <div key={index} className="text-sm text-red-800 mb-2">
                    <strong>ID:</strong> {ghost.conversationId} | 
                    <strong>Post:</strong> {ghost.postId} | 
                    <strong>Reason:</strong> {ghost.reason}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Orphaned Message Detection Section */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-3 text-gray-700">2. Detect Orphaned Messages</h3>
          <p className="text-sm text-gray-600 mb-4">
            Scan for messages that exist without valid parent conversations.
          </p>
          <button
            onClick={detectOrphanedMessages}
            disabled={loading}
            className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Detecting...' : 'Detect Orphaned Messages'}
          </button>
          
          {orphanedMessages.length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium text-gray-700 mb-2">
                Found {orphanedMessages.length} Orphaned Message(s):
              </h4>
              <div className="bg-purple-50 border border-purple-200 rounded p-3 max-h-60 overflow-y-auto">
                {orphanedMessages.map((orphan, index) => (
                  <div key={index} className="text-sm text-purple-800 mb-2">
                    <strong>Message:</strong> {orphan.messageId} | 
                    <strong>Conversation:</strong> {orphan.conversationId} | 
                    <strong>Reason:</strong> {orphan.reason}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Cleanup Section */}
        {(ghostConversations.length > 0 || orphanedMessages.length > 0) && (
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3 text-gray-700">3. Clean Up Orphaned Data</h3>
            <p className="text-sm text-gray-600 mb-4">
              Remove all detected ghost conversations and orphaned messages. This action cannot be undone.
            </p>
            
            <div className="space-y-3">
              {ghostConversations.length > 0 && (
                <button
                  onClick={cleanupGhosts}
                  disabled={loading}
                  className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed mr-3"
                >
                  {loading ? 'Cleaning...' : `Clean Up ${ghostConversations.length} Ghost Conversation(s)`}
                </button>
              )}
              
              {orphanedMessages.length > 0 && (
                <button
                  onClick={cleanupOrphanedMessages}
                  disabled={loading}
                  className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Cleaning...' : `Clean Up ${orphanedMessages.length} Orphaned Message(s)`}
                </button>
              )}
            </div>
            
            {cleanupResult && (
              <div className="mt-4">
                <h4 className="font-medium text-gray-700 mb-2">Cleanup Results:</h4>
                <div className="bg-green-50 border border-green-200 rounded p-3">
                  <div className="text-sm text-green-800">
                    <div>✅ Successfully cleaned: {cleanupResult.success}</div>
                    {cleanupResult.failed > 0 && <div>❌ Failed: {cleanupResult.failed}</div>}
                    {cleanupResult.errors.length > 0 && (
                      <div className="mt-2">
                        <strong>Errors:</strong>
                        <div className="bg-red-50 border border-red-200 rounded p-2 mt-1 max-h-32 overflow-y-auto">
                          {cleanupResult.errors.map((error, index) => (
                            <div key={index} className="text-xs text-red-700">{error}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Integrity Validation Section */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-3 text-gray-700">4. Validate System Integrity</h3>
          <p className="text-sm text-gray-600 mb-4">
            Comprehensive check of all conversations and messages for data integrity issues.
          </p>
          <button
            onClick={validateIntegrity}
            disabled={loading}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Validating...' : 'Validate System Integrity'}
          </button>
          
          {integrityResult && (
            <div className="mt-4">
              <h4 className="font-medium text-gray-700 mb-2">Integrity Results:</h4>
              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><strong>Total Conversations:</strong> {integrityResult.totalConversations}</div>
                  <div><strong>Valid Conversations:</strong> {integrityResult.validConversations}</div>
                  <div><strong>Ghost Conversations:</strong> {integrityResult.ghostConversations}</div>
                  <div><strong>Orphaned Messages:</strong> {integrityResult.orphanedMessages}</div>
                </div>
                
                {integrityResult.details.length > 0 && (
                  <div className="mt-3">
                    <strong>Details:</strong>
                    <div className="bg-white border border-blue-200 rounded p-2 mt-1 max-h-40 overflow-y-auto">
                      {integrityResult.details.map((detail: string, index: number) => (
                        <div key={index} className="text-xs text-blue-700 mb-1">{detail}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-2 text-yellow-800">⚠️ Important Notes</h3>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• This tool is for administrators only</li>
            <li>• Ghost conversations reference deleted posts</li>
            <li>• Orphaned messages exist without valid conversations</li>
            <li>• Cleanup operations cannot be undone</li>
            <li>• Always run detection before cleanup</li>
            <li>• Use integrity validation for complete system overview</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
