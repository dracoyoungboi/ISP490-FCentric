package com.dev.backend.services.impl.utils;


import com.dev.backend.dto.response.FileObjectInfo;
import com.dev.backend.services.MinioService;
import io.minio.*;
import io.minio.errors.ErrorResponseException;
import io.minio.http.Method;
import io.minio.messages.Item;
import org.apache.commons.io.IOUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;

@Service
public class MinioServiceImpl implements MinioService {

    private static final Logger logger = LoggerFactory.getLogger(MinioServiceImpl.class);

    @Autowired
    private MinioClient minioClient;
    @Autowired
    private String minioBucketName;
    @Autowired
    private String minioEndpoint;

    @Override
    public String upload(MultipartFile file) throws Exception {
        String objectName = file.getOriginalFilename() + new Date().getTime();
        return upload(file, objectName);
    }

    @Override
    public String upload(MultipartFile file, String objectName) throws Exception {
        try (InputStream is = file.getInputStream()) {
            // Lấy đuôi tệp gốc (null-safe: Map.of không chấp nhận giá trị null)
            String originalFilename = file.getOriginalFilename() != null
                    ? file.getOriginalFilename()
                    : objectName;
            String fileExtension = originalFilename != null && originalFilename.contains(".")
                    ? originalFilename.substring(originalFilename.lastIndexOf("."))
                    : "";

            ObjectWriteResponse res = minioClient.putObject(
                    PutObjectArgs.builder()
                            .bucket(minioBucketName)
                            .object(objectName)
                            .stream(is, file.getSize(), -1)
                            .contentType(file.getContentType())
                            .userMetadata(Map.of(
                                    "original-filename", originalFilename,
                                    "file-extension", fileExtension
                            ))
                            .build());
            logger.info("Uploaded to MinIO: {} -> etag:{}", objectName, res.etag());
            return objectName;
        }
    }

    @Override
    public byte[] download(String objectName) throws Exception {
        try (InputStream stream = minioClient.getObject(GetObjectArgs.builder()
                .bucket(minioBucketName)
                .object(objectName)
                .build())) {
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            IOUtils.copy(stream, buffer);
            return buffer.toByteArray();
        }
    }

    @Override
    public boolean delete(String objectName) {
        try {
            minioClient.removeObject(RemoveObjectArgs.builder()
                    .bucket(minioBucketName)
                    .object(objectName)
                    .build());
            return true;
        } catch (Exception e) {
            logger.error("Failed to delete object {}: {}", objectName, e.getMessage());
            return false;
        }
    }

    @Override
    public List<String> list(String prefix) throws Exception {
        Iterable<Result<Item>> results = minioClient.listObjects(ListObjectsArgs.builder()
                .bucket(minioBucketName)
                .prefix(prefix == null ? "" : prefix)
                .recursive(true)
                .build());
        List<String> keys = new ArrayList<>();
        for (Result<Item> result : results) {
            Item item = result.get();
            keys.add(item.objectName());
        }
        return keys;
    }

    @Override
    public boolean exists(String objectName) {
        try {
            minioClient.statObject(StatObjectArgs.builder()
                    .bucket(minioBucketName)
                    .object(objectName)
                    .build());
            return true;
        } catch (ErrorResponseException e) {
            return false;
        } catch (Exception e) {
            logger.error("Error checking object existence {}: {}", objectName, e.getMessage());
            return false;
        }
    }

    @Override
    public String getPublicUrl(String objectName) {
        return minioEndpoint.endsWith("/")
                ? minioEndpoint + minioBucketName + "/" + objectName
                : minioEndpoint + "/" + minioBucketName + "/" + objectName;
    }

    @Override
    public String generatePresignedUploadUrl(String objectName, int expirySeconds) throws Exception {
        return minioClient.getPresignedObjectUrl(
                GetPresignedObjectUrlArgs.builder()
                        .method(Method.PUT)
                        .bucket(minioBucketName)
                        .object(objectName)
                        .expiry(expirySeconds)
                        .build()
        );
    }

    @Override
    public String generatePresignedDownloadUrl(String objectName, int expirySeconds) throws Exception {
        return minioClient.getPresignedObjectUrl(
                GetPresignedObjectUrlArgs.builder()
                        .method(Method.GET)
                        .bucket(minioBucketName)
                        .object(objectName)
                        .expiry(expirySeconds)
                        .build()
        );
    }

    @Override
    public InputStream getObjectRange(String objectName, Long start, Long end) throws Exception {
        GetObjectArgs.Builder builder = GetObjectArgs.builder()
                .bucket(minioBucketName)
                .object(objectName);

        if (start != null && end != null) {
            builder.offset(start).length(end - start + 1);
        } else if (start != null) {
            builder.offset(start);
        }

        return minioClient.getObject(builder.build());
    }

    @Override
    public String getBucketName() {
        return minioBucketName;
    }

    @Override
    public MinioClient getMinioClient() {
        return minioClient;
    }

    @Override
    public FileObjectInfo getObjectInfo(String objectName) throws Exception {
        try {
            StatObjectResponse stat = minioClient.statObject(StatObjectArgs.builder()
                    .bucket(minioBucketName)
                    .object(objectName)
                    .build());

            return FileObjectInfo.builder()
                    .objectName(stat.object())
                    .bucketName(stat.bucket())
                    .size(stat.size())
                    .contentType(stat.contentType())
                    .etag(stat.etag())
                    .lastModified(stat.lastModified())
                    .userMetadata(stat.userMetadata())
                    .region(stat.region())
                    .versionId(stat.versionId())
                    .build();
        } catch (ErrorResponseException e) {
            logger.error("Object not found: {}", objectName);
            throw new Exception("Object not found: " + objectName, e);
        } catch (Exception e) {
            logger.error("Error getting object info {}: {}", objectName, e.getMessage());
            throw e;
        }
    }
}


