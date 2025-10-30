import { useEffect } from 'react';
import { messageService } from '@/services/firebase/messages';

const FixConversation = () => {
  useEffect(() => {
    const fixConversation = async () => {
      try {
        console.log('🚀 Fixing conversation 9exeanM8HnD4SgBS6BJY...');
        const success = await messageService.fixConversationParticipantInfo('9exeanM8HnD4SgBS6BJY');
        if (success) {
          console.log('✅ Successfully fixed conversation');
          alert('Successfully fixed conversation! Please refresh the page to see changes.');
        } else {
          console.error('❌ Failed to fix conversation');
          alert('Failed to fix conversation. Check console for details.');
        }
      } catch (error) {
        console.error('❌ Error fixing conversation:', error);
        alert('Error fixing conversation. Check console for details.');
      }
    };

    fixConversation();
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Fixing Conversation...</h1>
      <p>Please check the browser console for progress updates.</p>
    </div>
  );
};

export default FixConversation;
