// src/context/AuthContext.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/firebaseConfig';


interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, role: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;

    // Fetch user document from Firestore users collection
    const { getDoc } = await import('firebase/firestore');
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (!userDoc.exists()) {
      await signOut(auth);
      throw new Error('User profile not found in database.');
    }

    const userData = userDoc.data();
    if ((userData.role || '').toLowerCase() !== 'admin') {
      await signOut(auth);
      throw new Error('Access Denied: Only administrators are permitted to access this portal.');
    }
  };

  const register = async (email: string, password: string, name: string, role: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    if (userCredential.user) {
      const u = userCredential.user;
      await updateProfile(u, { displayName: name });

      // Save user profile details to Firestore users collection
      await setDoc(doc(db, 'users', u.uid), {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: password, // Store plaintext password for admin reference & sync
        role: role, // Selected role
        status: 'Active', // Default status as requested
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // If the role is NOT admin, sign them out immediately
      if (role.toLowerCase() !== 'admin') {
        const { signOut: authSignOut } = await import('firebase/auth');
        await authSignOut(auth);
        throw new Error('REGISTRATION_SUCCESS_NON_ADMIN');
      }
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
