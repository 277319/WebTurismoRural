from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, computed_field, model_validator

from app.core.archivos import url_foto_emprendimiento
from app.schemas.validadores import (
    ColorHex,
    SitioWeb,
    Telefono,
    TelefonoWhatsapp,
    Texto100,
    Texto150,
    Texto255,
    TextoLargo2000,
    TextoLargo5000,
    UsuarioFacebook,
    UsuarioInstagram,
    UsuarioTiktok,
)


class RedesContacto(BaseModel):
    """Todas opcionales. Instagram/Facebook/TikTok aceptan '@usuario' o la URL del perfil."""

    model_config = ConfigDict(extra="forbid")

    instagram: UsuarioInstagram = None
    facebook: UsuarioFacebook = None
    tiktok: UsuarioTiktok = None
    whatsapp: TelefonoWhatsapp = None
    sitio_web: SitioWeb = None


class Bloque(BaseModel):
    """Bloque opcional de contenido. Al desactivarlo se conserva el texto para poder reactivarlo."""

    model_config = ConfigDict(extra="forbid")

    activo: bool = False
    contenido: TextoLargo2000 = None

    @model_validator(mode="after")
    def contenido_si_activo(self) -> "Bloque":
        if self.activo and not self.contenido:
            raise ValueError("Escribe el contenido o desactiva este bloque")
        return self


class Bloques(BaseModel):
    model_config = ConfigDict(extra="forbid")

    gastronomia: Bloque = Field(default_factory=Bloque)
    festividades: Bloque = Field(default_factory=Bloque)
    normas_visita: Bloque = Field(default_factory=Bloque)


class EmprendimientoCrear(BaseModel):
    nombre: Texto150
    telefono_contacto: Telefono
    direccion: Texto255
    localidad: Texto100


class EmprendimientoEditar(EmprendimientoCrear):
    """PUT /emprendimientos/{id}: reemplaza todos los datos. null en descripción/historia los borra."""

    descripcion: TextoLargo2000
    historia: TextoLargo5000
    redes: RedesContacto


class EmprendimientoPersonalizar(BaseModel):
    """PUT /emprendimientos/{id}/personalizacion. La portada se sube aparte (PUT .../portada)."""

    model_config = ConfigDict(extra="forbid")

    color_primario: ColorHex
    color_secundario: ColorHex
    relato_comunidad: TextoLargo5000
    bloques: Bloques


class EmprendimientoPublico(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    telefono_contacto: str
    direccion: str
    localidad: str
    descripcion: str | None
    historia: str | None
    redes: dict[str, str]
    foto_perfil: str | None = Field(exclude=True)
    color_primario: str
    color_secundario: str
    portada_url: str | None
    relato_comunidad: str | None
    bloques: Bloques
    usuario_id: int
    fecha_creacion: datetime
    fecha_actualizacion: datetime

    @computed_field
    @property
    def foto_url(self) -> str | None:
        return url_foto_emprendimiento(self.foto_perfil)
