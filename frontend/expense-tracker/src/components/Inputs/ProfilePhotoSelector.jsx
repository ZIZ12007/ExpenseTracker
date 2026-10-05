import React, { useRef, useState } from 'react';
import { LuUser, LuUpload, LuTrash } from 'react-icons/lu';

const ProfilePhotoSelector = ({ setImage }) => {
  
    const inputRef = useRef(null);
    const [previewUrl, setPreviewUrl] = useState(null);

    const handleImageChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            // Update the image state
            setImage(file);

            // Generate preview Url
            const preview = URL.createObjectURL(file);
            setPreviewUrl(preview);
        }
    };

    const handleRemoveImage = () => {
        setImage(null);
        setPreviewUrl(null);
    };

    const onChooseFile = () => {
        inputRef.current?.click();
    };

    return (
        <div className="flex justify-center mb-6">
            <input
                type="file"
                accept="image/*"
                ref={inputRef}
                onChange={handleImageChange}
                className="hidden"
            />

            <div className="relative">
                {!previewUrl ? (
                    <button
                        type="button"
                        onClick={onChooseFile}
                        className="group flex h-20 w-20 items-center justify-center rounded-full bg-violet-100 text-violet-700 transition hover:bg-violet-200"
                    >
                        <LuUser className="text-4xl" />
                        <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg">
                            <LuUpload className="text-[18px]" />
                        </div>
                    </button>
                ) : (
                    <div className="relative h-20 w-20">
                        <img
                            src={previewUrl}
                            alt="profile preview"
                            className="h-20 w-20 rounded-full object-cover"
                        />
                        <button
                            type="button"
                            onClick={handleRemoveImage}
                            className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-white text-red-500 shadow-lg border border-slate-200"
                        >
                            <LuTrash className="text-base" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProfilePhotoSelector