import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, limit, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

export const useSupportUnread = (userId: string | undefined) => {
    const [unreadCount, setUnreadCount] = useState(0);
    const [ticketId, setTicketId] = useState<string | null>(null);

    useEffect(() => {
        if (!userId) {
            setUnreadCount(0);
            setTicketId(null);
            return;
        }

        // 1. Find the latest ticket for this user (persistent chat)
        const ticketsRef = collection(db, 'supportTickets');
        // We use clientId or userId depending on the schema (SupportChat uses userId, SupportChatClient uses clientId)
        // To be safe, we'll try to match where userId OR clientId matches the currentUser
        const q = query(
            ticketsRef,
            where('userId', '==', userId),
            orderBy('createdAt', 'desc'),
            limit(1)
        );

        // Fallback or secondary check if clientId is used instead of userId
        const qClient = query(
            ticketsRef,
            where('clientId', '==', userId),
            orderBy('createdAt', 'desc'),
            limit(1)
        );

        const handleSnapshot = (snapshot: any) => {
            if (!snapshot.empty) {
                const ticket = snapshot.docs[0].data();
                setTicketId(snapshot.docs[0].id);
                setUnreadCount(ticket.unreadByClient || 0);
            }
        };

        const unsub = onSnapshot(q, handleSnapshot);
        const unsubClient = onSnapshot(qClient, handleSnapshot);

        return () => {
            unsub();
            unsubClient();
        };
    }, [userId]);

    return { unreadCount, ticketId };
};
