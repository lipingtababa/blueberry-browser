import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'

interface Message {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: number
    isStreaming?: boolean
}

interface Recording {
    id: string
    name: string
    description?: string
    createdAt: number
    updatedAt: number
    actions: any[]
    metadata?: {
        targetSite?: string
        duration?: number
        manualSteps?: number
    }
}

interface ChatContextType {
    messages: Message[]
    isLoading: boolean
    recordings: Recording[]
    showRecordings: boolean

    // Chat actions
    sendMessage: (content: string) => Promise<void>
    clearChat: () => void

    // Recordings actions
    closeRecordingsList: () => void
    replayRecording: (recordingId: string) => Promise<void>
    deleteRecording: (recordingId: string) => Promise<void>

    // Page content access
    getPageContent: () => Promise<string | null>
    getPageText: () => Promise<string | null>
    getCurrentUrl: () => Promise<string | null>
}

const ChatContext = createContext<ChatContextType | null>(null)

export const useChat = () => {
    const context = useContext(ChatContext)
    if (!context) {
        throw new Error('useChat must be used within a ChatProvider')
    }
    return context
}

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [messages, setMessages] = useState<Message[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [recordings, setRecordings] = useState<Recording[]>([])
    const [showRecordings, setShowRecordings] = useState(false)

    // Load initial messages from main process
    useEffect(() => {
        const loadMessages = async () => {
            try {
                const storedMessages = await window.sidebarAPI.getMessages()
                if (storedMessages && storedMessages.length > 0) {
                    // Convert CoreMessage format to our frontend Message format
                    const convertedMessages = storedMessages.map((msg: any, index: number) => ({
                        id: `msg-${index}`,
                        role: msg.role,
                        content: typeof msg.content === 'string' 
                            ? msg.content 
                            : msg.content.find((p: any) => p.type === 'text')?.text || '',
                        timestamp: Date.now(),
                        isStreaming: false
                    }))
                    setMessages(convertedMessages)
                }
            } catch (error) {
                console.error('Failed to load messages:', error)
            }
        }
        loadMessages()
    }, [])

    const sendMessage = useCallback(async (content: string) => {
        setIsLoading(true)

        try {
            const messageId = Date.now().toString()

            // Send message to main process (which will handle context)
            await window.sidebarAPI.sendChatMessage({
                message: content,
                messageId: messageId
            })

            // Messages will be updated via the chat-messages-updated event
        } catch (error) {
            console.error('Failed to send message:', error)
        } finally {
            setIsLoading(false)
        }
    }, [])

    const clearChat = useCallback(async () => {
        try {
            await window.sidebarAPI.clearChat()
            setMessages([])
        } catch (error) {
            console.error('Failed to clear chat:', error)
        }
    }, [])

    const getPageContent = useCallback(async () => {
        try {
            return await window.sidebarAPI.getPageContent()
        } catch (error) {
            console.error('Failed to get page content:', error)
            return null
        }
    }, [])

    const getPageText = useCallback(async () => {
        try {
            return await window.sidebarAPI.getPageText()
        } catch (error) {
            console.error('Failed to get page text:', error)
            return null
        }
    }, [])

    const getCurrentUrl = useCallback(async () => {
        try {
            return await window.sidebarAPI.getCurrentUrl()
        } catch (error) {
            console.error('Failed to get current URL:', error)
            return null
        }
    }, [])

    const closeRecordingsList = useCallback(() => {
        setShowRecordings(false)
    }, [])

    const replayRecording = useCallback(async (recordingId: string) => {
        try {
            const result = await window.sidebarAPI.recorderGetRecording(recordingId)
            if (!result.success || !result.recording) {
                alert('Recording not found')
                return
            }

            const recording = result.recording
            const replayResult = await window.sidebarAPI.replayerStart({
                recording,
                content: {},
                skipLogin: false,
                speed: 1
            })

            if (replayResult.success) {
                setShowRecordings(false)
                console.log('Replay started successfully')
            } else {
                alert(`Failed to start replay: ${replayResult.error}`)
            }
        } catch (error) {
            console.error('Failed to replay recording:', error)
            alert('Failed to replay recording')
        }
    }, [])

    const deleteRecording = useCallback(async (recordingId: string) => {
        if (!confirm('Are you sure you want to delete this recording?')) {
            return
        }

        try {
            const result = await window.sidebarAPI.recorderDeleteRecording(recordingId)
            if (result.success) {
                // Remove from local state
                setRecordings(prev => prev.filter(r => r.id !== recordingId))
            } else {
                alert(`Failed to delete recording: ${result.error}`)
            }
        } catch (error) {
            console.error('Failed to delete recording:', error)
            alert('Failed to delete recording')
        }
    }, [])

    // Set up message listeners
    useEffect(() => {
        // Listen for streaming response updates
        const handleChatResponse = (data: { messageId: string; content: string; isComplete: boolean }) => {
            console.log('[CHAT] handleChatResponse:', data)
            if (data.isComplete) {
                console.log('[CHAT] Response complete, setting isLoading=false')
                setIsLoading(false)
            }
        }

        // Listen for message updates from main process
        const handleMessagesUpdated = (updatedMessages: any[]) => {
            console.log('[CHAT] handleMessagesUpdated - received messages:', updatedMessages.length)
            console.log('[CHAT] Messages:', updatedMessages)
            // Convert CoreMessage format to our frontend Message format
            const convertedMessages = updatedMessages.map((msg: any, index: number) => ({
                id: `msg-${index}`,
                role: msg.role,
                content: typeof msg.content === 'string'
                    ? msg.content
                    : msg.content.find((p: any) => p.type === 'text')?.text || '',
                timestamp: Date.now(),
                isStreaming: false
            }))
            console.log('[CHAT] Converted messages:', convertedMessages)
            setMessages(convertedMessages)
            console.log('[CHAT] Messages state updated')
        }

        // Listen for recordings list
        const handleShowRecordings = (recordingsList: Recording[]) => {
            console.log('[CHAT] Received recordings list:', recordingsList.length)
            setRecordings(recordingsList)
            setShowRecordings(true)
        }

        window.sidebarAPI.onChatResponse(handleChatResponse)
        window.sidebarAPI.onMessagesUpdated(handleMessagesUpdated)
        window.electron.ipcRenderer.on('show-recordings', (_event, recordingsList) => {
            handleShowRecordings(recordingsList)
        })

        return () => {
            window.sidebarAPI.removeChatResponseListener()
            window.sidebarAPI.removeMessagesUpdatedListener()
            window.electron.ipcRenderer.removeAllListeners('show-recordings')
        }
    }, [])

    const value: ChatContextType = {
        messages,
        isLoading,
        recordings,
        showRecordings,
        sendMessage,
        clearChat,
        closeRecordingsList,
        replayRecording,
        deleteRecording,
        getPageContent,
        getPageText,
        getCurrentUrl
    }

    return (
        <ChatContext.Provider value={value}>
            {children}
        </ChatContext.Provider>
    )
}

