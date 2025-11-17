import React, { useState } from 'react'
import { Circle, Square, Pause, Play, List, Clock } from 'lucide-react'
import { ToolBarButton } from './ToolBarButton'

export const RecorderControls: React.FC = () => {
    const [isRecording, setIsRecording] = useState(false)
    const [isPaused, setIsPaused] = useState(false)

    const handleStartRecording = async () => {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
            const name = `Recording-${timestamp}`
            const result = await window.topBarAPI.recorderStart(name, undefined)

            if (result.success) {
                setIsRecording(true)
                setIsPaused(false)
            } else {
                alert(`Failed to start recording: ${result.error}`)
            }
        } catch (error) {
            console.error('Failed to start recording:', error)
            alert('Failed to start recording')
        }
    }

    const handleStopRecording = async () => {
        try {
            const result = await window.topBarAPI.recorderStop()

            if (result.success) {
                setIsRecording(false)
                setIsPaused(false)
                alert('Recording saved successfully!')
            } else {
                alert(`Failed to stop recording: ${result.error}`)
            }
        } catch (error) {
            console.error('Failed to stop recording:', error)
            alert('Failed to stop recording')
        }
    }

    const handlePauseResume = async () => {
        try {
            if (isPaused) {
                const result = await window.topBarAPI.recorderResume()
                if (result.success) {
                    setIsPaused(false)
                }
            } else {
                const result = await window.topBarAPI.recorderPause()
                if (result.success) {
                    setIsPaused(true)
                }
            }
        } catch (error) {
            console.error('Failed to pause/resume recording:', error)
        }
    }

    const handleAddManualStep = async () => {
        try {
            const description = `Manual step at ${new Date().toLocaleTimeString()}`
            const result = await window.topBarAPI.recorderAddManualStep(description)
            if (!result.success) {
                alert(`Failed to add manual step: ${result.error}`)
            }
        } catch (error) {
            console.error('Failed to add manual step:', error)
        }
    }

    const handleShowRecordings = async () => {
        try {
            // Send event to sidebar to show recordings
            await window.topBarAPI.showRecordingsList()
        } catch (error) {
            console.error('Failed to show recordings:', error)
        }
    }

    return (
        <div className="flex items-center gap-1">
            {!isRecording ? (
                <>
                    <ToolBarButton
                        Icon={Circle}
                        onClick={handleStartRecording}
                    />
                    <ToolBarButton
                        Icon={List}
                        onClick={handleShowRecordings}
                    />
                </>
            ) : (
                <>
                    <ToolBarButton
                        Icon={isPaused ? Play : Pause}
                        onClick={handlePauseResume}
                    />
                    <ToolBarButton
                        Icon={Clock}
                        onClick={handleAddManualStep}
                    />
                    <ToolBarButton
                        Icon={Square}
                        onClick={handleStopRecording}
                        className="text-red-500 hover:text-red-600"
                    />
                    <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                </>
            )}
        </div>
    )
}
