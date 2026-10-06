package com.dev.backend.repository;

import com.dev.backend.entities.CauHinhMauIn;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CauHinhMauInRepository extends JpaRepository<CauHinhMauIn, Long> {

    List<CauHinhMauIn> findAllByDocumentType(String documentType);

    Optional<CauHinhMauIn> findByDocumentTypeAndTemplateId(String documentType, String templateId);

    long countByDocumentType(String documentType);
}
