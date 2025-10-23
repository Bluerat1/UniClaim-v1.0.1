import React, { createContext, useContext, useState, ReactNode } from 'react';
import { TouchableOpacity, View } from 'react-native';

interface PostCardMenuContextType {
  openMenuId: string | null;
  openMenu: (menuId: string) => void;
  closeMenu: () => void;
  closeSpecificMenu: (menuId: string) => void;
}

const PostCardMenuContext = createContext<PostCardMenuContextType | undefined>(undefined);

export const PostCardMenuProvider = ({ children }: { children: ReactNode }) => {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const openMenu = (menuId: string) => {
    // If clicking the same menu that's already open, close it
    if (openMenuId === menuId) {
      setOpenMenuId(null);
    } else {
      // Close any currently open menu and open the new one
      setOpenMenuId(menuId);
    }
  };

  const closeMenu = () => {
    setOpenMenuId(null);
  };

  const closeSpecificMenu = (menuId: string) => {
    if (openMenuId === menuId) {
      setOpenMenuId(null);
    }
  };

  return (
    <PostCardMenuContext.Provider
      value={{
        openMenuId,
        openMenu,
        closeMenu,
        closeSpecificMenu,
      }}
    >
      {children}
      {/* Global backdrop that appears when any menu is open */}
      {openMenuId && (
        <TouchableOpacity
          className="absolute inset-0"
          style={{
            zIndex: 30,
            backgroundColor: 'transparent'
          }}
          onPress={closeMenu}
          activeOpacity={1}
        />
      )}
    </PostCardMenuContext.Provider>
  );
};

export const usePostCardMenu = () => {
  const context = useContext(PostCardMenuContext);
  if (context === undefined) {
    throw new Error('usePostCardMenu must be used within a PostCardMenuProvider');
  }
  return context;
};
